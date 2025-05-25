const express = require('express');
const http = require("http");
const WebSocket = require("ws");
const os = require('os');
const path = require('path');
const fs = require('fs');


//import model accesslog
const AccessLog = require('../src/models/AccessLog');

module.exports = function setupWebSocket(server) {
  console.log('>> [DEBUG] Đã vào setupWebSocket!');
  const wss = new WebSocket.Server({ server });
  console.log("[WS] WebSocket server started!");

  wss.on('connection', (ws) => {
    console.log("[WS] Client connected!");
    ws.send('Kết nối WS thành công!');
    ws.on('message', (msg) => {
      console.log("[WS] Received from client:", msg.toString());
      ws.send(`Server received: ${msg}`);
    });
    ws.on('close', () => {
      console.log("[WS] Client disconnected!");
    });
  });

  const TELEGRAM_BOT_TOKEN = '7542275864:AAGK9VDjry4pFMirq0F70puuG1BfV8dWDDs';
  const CHAT_ID = '8014894738'; // Thường là số

  let esp32Socket = null;
  const accessDataPath = path.join(__dirname, '..', 'Database', 'access_data.txt');


  let accessData = {
    password: "",
    rfidIds: []
  };

  function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: CHAT_ID,
      text: message
    };
    log("==> Gửi tin nhắn Telegram: " + message);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => {
      if (!res.ok) {
        log(`❌ Gửi tin nhắn Telegram thất bại: ${res.statusText}`);
      }
    }).catch(err => {
      log(`❌ Lỗi khi gửi tin nhắn Telegram: ${err.message}`);
    });
  }

  // Log có thời gian [ HH:mm DD/MM/YYYY ]
  function log(msg) {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const formattedTime = `[${hours}:${minutes} ${day}/${month}/${year}]`;
    console.log(`${formattedTime} ${msg}`);
  }

  // Đọc file access_data.txt
  if (fs.existsSync(accessDataPath)) {
    try {
      const data = fs.readFileSync(accessDataPath, 'utf8');
      accessData = JSON.parse(data);
      log("📂 Đã tải dữ liệu từ access_data.txt");
    } catch (err) {
      log("❌ Lỗi khi đọc access_data.txt: " + err.message);
    }
  }

  function saveAccessData() {
    fs.writeFile(accessDataPath, JSON.stringify(accessData, null, 2), (err) => {
      if (err) log("❌ Lỗi khi ghi file access_data.txt: " + err.message);
      else log("💾 Đã cập nhật access_data.txt");
    });
  }

  let ledStates = {
    led1: false, led2: false, led3: false, led4: false,
    led5: false, led6: false, led7: false
  };
  let fanStates = {
    fan1: false, fan2: false
  };
  let doorState = false;
  let timers = {};

  wss.on("connection", (ws) => {
    log("🔌 Kết nối mới từ client");

    if (ws !== esp32Socket && ws.readyState === WebSocket.OPEN) {
      for (let i = 1; i <= 7; i++) {
        ws.send(ledStates[`led${i}`] ? `LED_${i}_ON` : `LED_${i}_OFF`);
      }
      ws.send(doorState ? "DOOR_OPEN" : "DOOR_CLOSE");
      for (let i = 1; i <= 2; i++) {
        ws.send(fanStates[`fan${i}`] ? `FAN_${i}_ON` : `FAN_${i}_OFF`);
      }
    }

    ws.on("message", (message) => {
      const msgStr = message.toString();
      const source = ws === esp32Socket ? "ESP32-S3" : "Web Client";

      if (msgStr.includes("ESP32-S3")) {
        esp32Socket = ws;
        log(`✅ ${source} đã đăng ký là ESP32-S3`);
        return;
      }

      if (msgStr === "BUZZ_ON") {
        log("⚠️ Phát hiện khí gas! Đã bật còi cảnh báo.");
        sendTelegramMessage("⚠️ Phát hiện khí gas! Đã bật còi báo động!");
        return;
      } else if (msgStr === "BUZZ_OFF") {
        log("✅ Không còn khí gas. Đã tắt còi.");
        sendTelegramMessage("✅ Khí gas an toàn. Đã tắt còi cảnh báo.");
        return;
      }

      if (msgStr.startsWith("TEMP:")) {
        const temp = parseFloat(msgStr.split(":")[1]);
        log(`🌡️ Nhiệt độ hiện tại: ${temp}°C`);
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msgStr);
          }
        });
        return;
      }

      if (msgStr.startsWith("HUM:")) {
        const hum = parseFloat(msgStr.split(":")[1]);
        log(`💧 Độ ẩm hiện tại: ${hum}%`);
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msgStr);
          }
        });
        return;
      }

      const pwCheck2 = msgStr.match(/^CONFIRM_ADD_RFID_(.+)$/);
      if (pwCheck2) {
        const pw = pwCheck2[1];
        log(`🔑 Nhận yêu cầu kiểm tra mật khẩu từ ${source}: ${pw.slice(0, 2)}****`);
        const response = pw === accessData.password ? "CONFIRM_ADD_RFID_OK" : "CONFIRM_ADD_RFID_FAIL";
        ws.send(response);
        log(`🔑 Kiểm tra mật khẩu để thêm RFID: ${response === "CONFIRM_ADD_RFID_OK" ? "Thành công" : "Thất bại"}`);
        return;
      }

        // === Phân tích lệnh LED ===
  const ledMatch = msgStr.match(/^LED_([1-7])_(ON|OFF)$/);
  if (ledMatch) {
    const ledId = parseInt(ledMatch[1]);
    const action = ledMatch[2];
    const newState = action === "ON";
    const currentState = ledStates[`led${ledId}`];

    if (currentState !== newState) {
      ledStates[`led${ledId}`] = newState;
      log(`💡 Đã thay đổi: LED_${ledId} -> ${action === "ON" ? "Bật" : "Tắt"}`);

      if (esp32Socket?.readyState === WebSocket.OPEN) {
        esp32Socket.send(msgStr);
      }

      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(msgStr);
        }
      });
    }
    return;
  }

  // === Phân tích lệnh FAN ===
  const fanMatch = msgStr.match(/^FAN_([1-2])_(ON|OFF)$/);
  if (fanMatch) {
    const fanId = parseInt(fanMatch[1]);
    const action = fanMatch[2];
    const newState = action === "ON";
    const currentState = fanStates[`fan${fanId}`];

    if (currentState !== newState) {
      fanStates[`fan${fanId}`] = newState;
      log(`🌬️ Đã thay đổi: FAN_${fanId} -> ${action === "ON" ? "Bật" : "Tắt"}`);

      if (esp32Socket?.readyState === WebSocket.OPEN) {
        esp32Socket.send(msgStr);
      }

      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(msgStr);
        }
      });
    }
    return;
  }

    // === Phân tích lệnh cửa ===
    if (msgStr === "DOOR_OPEN") {
      doorState = true;
      ledStates.led5 = true; // Mở cửa thì bật đèn 5 theo

      if (esp32Socket?.readyState === WebSocket.OPEN) {
        esp32Socket.send("DOOR_OPEN");
        esp32Socket.send("LED_5_ON");
      }

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send("DOOR_OPEN");
          client.send("LED_5_ON");
        }
      });

      log("🚪 Cửa đã mở");
      return;
    }

    if (msgStr === "DOOR_CLOSE") {
      doorState = false;

      if (esp32Socket?.readyState === WebSocket.OPEN) {
        esp32Socket.send("DOOR_CLOSE");
      }

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send("DOOR_CLOSE");
        }
      });

      log("🚪 Cửa đã đóng");
      return;
  }

      const pwCheck1 = msgStr.match(/^CONFIRM_DELETE_RFID_(.+)$/);
      if (pwCheck1) {
        const pw = pwCheck1[1];
        log(`🔑 Nhận yêu cầu kiểm tra mật khẩu từ ${source}: ${pw.slice(0, 2)}****`);
        const response = pw === accessData.password ? "CONFIRM_DELETE_RFID_OK" : "CONFIRM_DELETE_RFID_FAIL";
        ws.send(response);
        log(`🔑 Kiểm tra mật khẩu để xóa RFID: ${response === "CONFIRM_DELETE_RFID_OK" ? "Thành công" : "Thất bại"}`);
        return;
      }

      const addMatch = msgStr.match(/^ADD_RFID_(.+)$/);
      if (addMatch) {
        const uid = addMatch[1];
        const exists = accessData.rfidList.some(entry => entry.id === uid);

        if (!exists) {
          accessData.rfidList.push({ id: uid, name: "UNKNOWN" });
          saveAccessData();
          ws.send("ADD_RFID_OK");
          log(`✅ Đã thêm RFID mới: ${uid}`);
        } else {
          ws.send("ADD_RFID_EXISTS");
          log(`ℹ️ RFID đã tồn tại: ${uid}`);
        }
        return;
      }

      const deleteMatch = msgStr.match(/^DELETE_RFID_(.+)$/);
      if (deleteMatch) {
        const uid = deleteMatch[1];
        const index = accessData.rfidList.findIndex(entry => entry.id === uid);

        if (index !== -1) {
          accessData.rfidList.splice(index, 1);
          saveAccessData();
          ws.send("DELETE_RFID_OK");
          log(`🗑️ Đã xóa RFID: ${uid}`);
        } else {
          ws.send("DELETE_RFID_NOT_FOUND");
          log(`❌ Không tìm thấy RFID để xóa: ${uid}`);
        }
        return;
      }

      const pwCheck = msgStr.match(/^VERIFY_PASSWORD_(.+)$/);
      if (pwCheck) {
        const pw = pwCheck[1];
        log(`🔑 Nhận yêu cầu kiểm tra mật khẩu từ ${source}: ${pw.slice(0, 2)}****`);
        const result = pw === accessData.password ? "PASSWORD_OK" : "PASSWORD_FAIL";
        ws.send(result);
        log(`🔑 Kết quả kiểm tra mật khẩu: ${result === "PASSWORD_OK" ? "Thành công" : "Thất bại"}`);
           // Ghi log
        AccessLog.create({
          device: 'Cửa',
          method: 'PASSWORD',
          result: result === 'PASSWORD_OK' ? 'Success' : 'Failed',
          time: new Date()
        });
        return;
      }

      const rfidCheck = msgStr.match(/^VERIFY_RFID_(.+)$/);
      if (rfidCheck) {
        const id = rfidCheck[1];
        log(`🏷 Nhận yêu cầu kiểm tra RFID từ ${source}: ${id}`);

        const entry = accessData.rfidList.find(r => r.id === id);
        if (entry) {
          const name = entry.name;
          const response = (name && name !== "UNKNOWN") ? `RFID_OK_${name}` : "RFID_OK";
          ws.send(response);
          log(`🏷 RFID hợp lệ. Gửi phản hồi: ${response}`);
        } else {
          ws.send("RFID_FAIL");
          log(`❌ RFID không hợp lệ: ${id}`);
        }
        AccessLog.create({
          device: 'Cửa',
          method: 'RFID',
          result: entry ? 'Success' : 'Failed',
          time: new Date()
        });
        return;
      }

      const updatePwCmd = msgStr.match(/^UPDATE_PASSWORD_(.+?)_(.+)$/);
      if (updatePwCmd) {
        const oldPassword = updatePwCmd[1];
        const newPassword = updatePwCmd[2];

        log(`🔐 [Đổi mật khẩu] Yêu cầu nhận được: Cũ = "${oldPassword}", Mới = "${newPassword}"`);

        if (oldPassword !== accessData.password) {
          ws.send("UPDATE_PASSWORD_FAIL_OLD_WRONG");
          log("🔐 Cập nhật mật khẩu thất bại: Mật khẩu cũ không đúng");
        } else if (!newPassword) {
          ws.send("UPDATE_PASSWORD_FAIL_EMPTY");
          log("🔐 Cập nhật mật khẩu thất bại: Mật khẩu mới rỗng");
        } else {
          accessData.password = newPassword;
          saveAccessData();
          ws.send("UPDATE_PASSWORD_OK");
          log("🔐 Đã cập nhật mật khẩu thành công.");
        }

        return;
      }

      try {
        const data = JSON.parse(msgStr);
        if (data.action === "updatePassword") {
          log(`🔐 Nhận yêu cầu cập nhật mật khẩu từ ${source}`);
          if (data.oldPassword !== accessData.password) {
            ws.send("UPDATE_PASSWORD_FAIL_OLD_WRONG");
            log(`🔐 Cập nhật mật khẩu thất bại: Mật khẩu cũ không đúng`);
          } else if (!data.newPassword) {
            ws.send("UPDATE_PASSWORD_FAIL_EMPTY");
            log(`🔐 Cập nhật mật khẩu thất bại: Mật khẩu mới rỗng`);
          } else {
            accessData.password = data.newPassword;
            saveAccessData();
            ws.send("UPDATE_PASSWORD_OK");
            log("🔐 Đã cập nhật mật khẩu thành công.");
          }
          return;
        }
      } catch {}

      const ledCommand = msgStr.match(/^LED_([1-7])_(ON|OFF)$/);
      if (ledCommand) {
        const ledId = parseInt(ledCommand[1]);
        const action = ledCommand[2];
        const newState = action === "ON";
        const currentState = ledStates[`led${ledId}`];

        if (currentState !== newState) {
          ledStates[`led${ledId}`] = newState;
          log(`💡 Đã thay đổi: LED_${ledId} -> ${action === "ON" ? "Bật" : "Tắt"}`);

          if (esp32Socket?.readyState === WebSocket.OPEN) {
            esp32Socket.send(msgStr);
          }

          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(msgStr);
            }
          });
        }
        return;
      }

      const fanCommand = msgStr.match(/^FAN_([1-2])_(ON|OFF)$/);
      if (fanCommand) {
        const fanId = parseInt(fanCommand[1]);
        const action = fanCommand[2];
        const newState = action === "ON";
        const currentState = fanStates[`fan${fanId}`];

        if (currentState !== newState) {
          fanStates[`fan${fanId}`] = newState;
          log(`🌬️ Đã thay đổi: FAN_${fanId} -> ${action === "ON" ? "Bật" : "Tắt"}`);

          if (esp32Socket?.readyState === WebSocket.OPEN) {
            esp32Socket.send(msgStr);
          }

          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(msgStr);
            }
          });
        }
        return;
      }

      if (msgStr === "DOOR_OPEN") {
        doorState = true;
        ledStates.led5 = true;

        if (esp32Socket?.readyState === WebSocket.OPEN) {
          esp32Socket.send("DOOR_OPEN");
          esp32Socket.send("LED_5_ON");
        }

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send("DOOR_OPEN");
            client.send("LED_5_ON");
          }
        });

        log("🚪 Cửa đã mở");
        return;
      }

      if (msgStr === "DOOR_CLOSE") {
        doorState = false;

        if (esp32Socket?.readyState === WebSocket.OPEN) {
          esp32Socket.send("DOOR_CLOSE");
        }

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send("DOOR_CLOSE");
          }
        });

        log("🚪 Cửa đã đóng");
        return;
      }

      const ledTimerCmd = msgStr.match(/^LED_([1-7])_(ON|OFF)_(\d{2}):(\d{2})$/);
      if (ledTimerCmd) {
        const [_, ledId, action, hour, minute] = ledTimerCmd;
        const key = `led${ledId}_${action}`;
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        const now = new Date();
        if (target <= now) target.setDate(target.getDate() + 1);
        const delay = target - now;

        if (timers[key]) {
          clearTimeout(timers[key]);
          log(`⏰ Đã hủy timer cũ cho ${key}`);
        }

        timers[key] = setTimeout(() => {
          const command = `LED_${ledId}_${action}`;
          const newState = action === "ON";
          if (ledStates[`led${ledId}`] !== newState) {
            ledStates[`led${ledId}`] = newState;
            log(`⏰ [Timer] Thực thi: ${command}`);
            wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(command));
            esp32Socket?.readyState === WebSocket.OPEN && esp32Socket.send(command);
          }
        }, delay);
        const hours12 = target.getHours() % 12 || 12;
        const minutes = target.getMinutes().toString().padStart(2, '0');
        const ampm = target.getHours() >= 12 ? 'PM' : 'AM';
        log(`⏰ Đã đặt timer cho LED_${ledId}_${action} lúc ${hours12}:${minutes} ${ampm}`);
        return;
      }

      const cancelLedCmd = msgStr.match(/^CANCEL_LED_([1-7])_(ON|OFF)$/);
      if (cancelLedCmd) {
        const [_, ledId, mode] = cancelLedCmd;
        const key = `led${ledId}_${mode}`;
        if (timers[key]) {
          clearTimeout(timers[key]);
          delete timers[key];
          log(`❌ Đã hủy timer cho LED_${ledId}_${mode === "ON" ? "Bật" : "Tắt"}`);
        } else {
          log(`⚠️ Không tìm thấy timer để hủy cho LED_${ledId}_${mode === "ON" ? "Bật" : "Tắt"}`);
        }
        return;
      }

      const fanTimerCmd = msgStr.match(/^FAN_([1-2])_(ON|OFF)_(\d{2}):(\d{2})$/);
      if (fanTimerCmd) {
        const [_, fanId, action, hour, minute] = fanTimerCmd;
        const key = `fan${fanId}_${action}`;
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        const now = new Date();
        if (target <= now) target.setDate(target.getDate() + 1);
        const delay = target - now;

        if (timers[key]) {
          clearTimeout(timers[key]);
          log(`⏰ Đã hủy timer cũ cho ${key}`);
        }

        timers[key] = setTimeout(() => {
          const command = `FAN_${fanId}_${action}`;
          const newState = action === "ON";
          if (fanStates[`fan${fanId}`] !== newState) {
            fanStates[`fan${fanId}`] = newState;
            log(`⏰ [Timer] Thực thi: ${command}`);
            wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(command));
            esp32Socket?.readyState === WebSocket.OPEN && esp32Socket.send(command);
          }
        }, delay);
        const hours12 = target.getHours() % 12 || 12;
        const minutes = target.getMinutes().toString().padStart(2, '0');
        const ampm = target.getHours() >= 12 ? 'PM' : 'AM';
        log(`⏰ Đã đặt timer cho LED_${ledId}_${action} lúc ${hours12}:${minutes} ${ampm}`);
        return;
      }

      const cancelFanCmd = msgStr.match(/^CANCEL_FAN_([1-2])_(ON|OFF)$/);
      if (cancelFanCmd) {
        const [_, fanId, mode] = cancelFanCmd;
        const key = `fan${fanId}_${mode}`;
        if (timers[key]) {
          clearTimeout(timers[key]);
          delete timers[key];
          log(`❌ Đã hủy timer cho FAN_${fanId}_${mode === "ON" ? "Bật" : "Tắt"}`);
        } else {
          log(`⚠️ Không tìm thấy timer để hủy cho FAN_${fanId}_${mode === "ON" ? "Bật" : "Tắt"}`);
        }
        return;
      }

      log(`❌ ${source} gửi lệnh không hợp lệ: ${msgStr}`);
    });

    ws.on("close", () => {
      if (ws === esp32Socket) {
        esp32Socket = null;
        log("❌ ESP32-S3 đã ngắt kết nối");
      } else {
        log("🛑 Web Client đã ngắt kết nối");
      }
    });
  });
};