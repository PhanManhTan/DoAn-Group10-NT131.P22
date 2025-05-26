const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const AccessData = require('../src/models/AccessData'); 
const AccessLog = require('../src/models/AccessLog');

module.exports = async function setupWebSocket(server) {
  console.log('>> [DEBUG] Initializing WebSocket server');


  // State Management
  let accessData = { password: '', rfidList: [] };
  let ledStates = { led1: false, led2: false, led3: false, led4: false, led5: false, led6: false, led7: false };
  let fanStates = { fan1: false, fan2: false };
  let doorState = false;
  let timers = {};
  let esp32Socket = null;

  // Telegram Configuration
  const TELEGRAM_BOT_TOKEN = process.env.telegram_bot_token;
  const CHAT_ID = process.env.chat_id;

  // Utility Functions
  const log = (msg) => {
    const now = new Date();
    const formattedTime = now.toLocaleString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    console.log(`[${formattedTime}] ${msg}`);
  };

  const sendTelegramMessage = async (message) => {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: message })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      log(`==> Sent Telegram message: ${message}`);
    } catch (err) {
      log(`❌ Failed to send Telegram message: ${err.message}`);
    }
  };

  const loadAccessData = async () => {
  try {
    let data = await AccessData.findOne({}).lean().exec();
    //log(`📂 Dữ liệu thô từ MongoDB: ${JSON.stringify(data)}`);
    if (!data) {
      data = new AccessData({ password: '', rfidList: [] });
      await data.save();
      //log('📂 Khởi tạo dữ liệu mặc định trong MongoDB');
    }
    accessData = { password: data.password, rfidList: data.rfidList };
    //log(`📂 Đã tải accessData: ${JSON.stringify(accessData)}`);
  } catch (err) {
    //log(`❌ Lỗi tải dữ liệu: ${err.stack}`);
  }
};

const saveAccessData = async () => {
  try {
    const result = await AccessData.updateOne(
      {},
      { $set: { password: accessData.password, rfidList: accessData.rfidList } },
      { upsert: true }
    );
    log(`💾 Cập nhật MongoDB: ${JSON.stringify(result)}`);
  } catch (err) {
    log(`❌ Lỗi lưu dữ liệu: ${err.stack}`);
  }
};

  const broadcastToClients = (message, excludeWs) => {
    wss.clients.forEach(client => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Load initial data
  await loadAccessData();

  // WebSocket Server Setup
  const wss = new WebSocket.Server({ server });
  log('[WS] WebSocket server started');

  // Handle WebSocket Connections
  wss.on('connection', (ws) => {
    log('🔌 New client connection');

    // Send initial states to new client
    if (ws !== esp32Socket && ws.readyState === WebSocket.OPEN) {
      Object.keys(ledStates).forEach((led, i) => {
        ws.send(`${ledStates[led] ? `LED_${i + 1}_ON` : `LED_${i + 1}_OFF`}`);
      });
      ws.send(doorState ? 'DOOR_OPEN' : 'DOOR_CLOSE');
      Object.keys(fanStates).forEach((fan, i) => {
        ws.send(`${fanStates[fan] ? `FAN_${i + 1}_ON` : `FAN_${i + 1}_OFF`}`);
      });
    }

    ws.on('message', async (message) => {
      const msgStr = message.toString();
      const source = ws === esp32Socket ? 'ESP32-S3' : 'Web Client';
      log(`📩 ${source}: ${msgStr}`);

      // Handle ESP32 Registration
      if (msgStr.includes('ESP32-S3')) {
        esp32Socket = ws;
        log(`✅ ${source} registered as ESP32-S3`);
        return;
      }

      // Handle Gas Detection
      if (msgStr === 'BUZZ_ON') {
        log('⚠️ Gas detected! Activating buzzer.');
        await sendTelegramMessage('⚠️ Gas detected! Buzzer activated!');
        return;
      } else if (msgStr === 'BUZZ_OFF') {
        log('✅ Gas cleared. Buzzer deactivated.');
        await sendTelegramMessage('✅ Gas safe. Buzzer deactivated.');
        return;
      }

      // Handle Sensor Data
      if (msgStr.startsWith('TEMP:')) {
        const temp = parseFloat(msgStr.split(':')[1]);
        log(`🌡️ Temperature: ${temp}°C`);
        broadcastToClients(msgStr, ws);
        return;
      }
      if (msgStr.startsWith('HUM:')) {
        const hum = parseFloat(msgStr.split(':')[1]);
        log(`💧 Humidity: ${hum}%`);
        broadcastToClients(msgStr, ws);
        return;
      }

      // Handle LED Commands
      const ledMatch = msgStr.match(/^LED_([1-7])_(ON|OFF)$/);
      if (ledMatch) {
        const ledId = parseInt(ledMatch[1]);
        const action = ledMatch[2];
        const newState = action === 'ON';
        if (ledStates[`led${ledId}`] !== newState) {
          ledStates[`led${ledId}`] = newState;
          log(`💡 LED_${ledId} -> ${action}`);
          if (esp32Socket?.readyState === WebSocket.OPEN) esp32Socket.send(msgStr);
          broadcastToClients(msgStr, ws);
        }
        return;
      }

      // Handle Fan Commands
      const fanMatch = msgStr.match(/^FAN_([1-2])_(ON|OFF)$/);
      if (fanMatch) {
        const fanId = parseInt(fanMatch[1]);
        const action = fanMatch[2];
        const newState = action === 'ON';
        if (fanStates[`fan${fanId}`] !== newState) {
          fanStates[`fan${fanId}`] = newState;
          log(`🌬️ FAN_${fanId} -> ${action}`);
          if (esp32Socket?.readyState === WebSocket.OPEN) esp32Socket.send(msgStr);
          broadcastToClients(msgStr, ws);
        }
        return;
      }

      // Handle Door Commands
      if (msgStr === 'DOOR_OPEN') {
        doorState = true;
        ledStates.led5 = true;
        log('🚪 Door opened');
        if (esp32Socket?.readyState === WebSocket.OPEN) {
          esp32Socket.send('DOOR_OPEN');
          esp32Socket.send('LED_5_ON');
        }
        broadcastToClients('DOOR_OPEN', null);
        broadcastToClients('LED_5_ON', null);
        return;
      }
      if (msgStr === 'DOOR_CLOSE') {
        doorState = false;
        log('🚪 Door closed');
        if (esp32Socket?.readyState === WebSocket.OPEN) esp32Socket.send('DOOR_CLOSE');
        broadcastToClients('DOOR_CLOSE', null);
        return;
      }

      // Handle Password Verification
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

      // Handle Add RFID
      const addMatch = msgStr.match(/^ADD_RFID_(.+)$/);
      if (addMatch) {
        const uid = addMatch[1];
        if (!accessData.rfidList.some(entry => entry.id === uid)) {
          accessData.rfidList.push({ id: uid, name: 'UNKNOWN' });
          await saveAccessData();
          ws.send('ADD_RFID_OK');
          log(`✅ Added RFID: ${uid}`);
        } else {
          ws.send('ADD_RFID_EXISTS');
          log(`ℹ️ RFID already exists: ${uid}`);
        }
        return;
      }

      // Handle Delete RFID
      const deleteMatch = msgStr.match(/^DELETE_RFID_(.+)$/);
      if (deleteMatch) {
        const uid = deleteMatch[1];
        const index = accessData.rfidList.findIndex(entry => entry.id === uid);
        if (index !== -1) {
          accessData.rfidList.splice(index, 1);
          await saveAccessData();
          ws.send('DELETE_RFID_OK');
          log(`🗑️ Deleted RFID: ${uid}`);
        } else {
          ws.send('DELETE_RFID_NOT_FOUND');
          log(`❌ RFID not found: ${uid}`);
        }
        return;
      }

      // Handle Password Confirmation for RFID Operations
      const pwCheckRfid = msgStr.match(/^(CONFIRM_ADD_RFID|CONFIRM_DELETE_RFID)_(.+)$/);
      if (pwCheckRfid) {
        const [, type, pw] = pwCheckRfid;
        log(`🔑 ${type} password check from ${source}`);
        const isMatch = pw === accessData.password;
        const response = isMatch ? `${type}_OK` : `${type}_FAIL`;
        ws.send(response);
        log(`🔑 ${type}: ${isMatch ? 'Success' : 'Failed'}`);
        return;
      }

      // Handle Password Update
      const updatePwCmd = msgStr.match(/^UPDATE_PASSWORD_(.+?)_(.+)$/);
      if (updatePwCmd) {
        const [, oldPassword, newPassword] = updatePwCmd;
        log(`🔐 Password update request`);
        if (oldPassword !== accessData.password) {
          ws.send('UPDATE_PASSWORD_FAIL_OLD_WRONG');
          log('🔐 Password update failed: Old password incorrect');
        } else if (!newPassword) {
          ws.send('UPDATE_PASSWORD_FAIL_EMPTY');
          log('🔐 Password update failed: New password empty');
        } else {
          accessData.password = newPassword;
          await saveAccessData();
          ws.send('UPDATE_PASSWORD_OK');
          log('🔐 Password updated successfully');
        }
        return;
      }

      // Handle LED Timer
      const ledTimerCmd = msgStr.match(/^LED_([1-7])_(ON|OFF)_(\d{2}):(\d{2})$/);
      if (ledTimerCmd) {
        const [, ledId, action, hour, minute] = ledTimerCmd;
        const key = `led${ledId}_${action}`;
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        const now = new Date();
        if (target <= now) target.setDate(target.getDate() + 1);
        const delay = target - now;

        if (timers[key]) {
          clearTimeout(timers[key]);
          log(`⏰ Cancelled previous timer for ${key}`);
        }

        timers[key] = setTimeout(() => {
          const command = `LED_${ledId}_${action}`;
          const newState = action === 'ON';
          if (ledStates[`led${ledId}`] !== newState) {
            ledStates[`led${ledId}`] = newState;
            log(`⏰ [Timer] Executed: ${command}`);
            broadcastToClients(command, null);
            if (esp32Socket?.readyState === WebSocket.OPEN) esp32Socket.send(command);
          }
          delete timers[key];
        }, delay);

        const timeStr = target.toLocaleTimeString('en-US', { hour12: true });
        log(`⏰ Set timer for LED_${ledId}_${action} at ${timeStr}`);
        return;
      }

      // Handle Cancel LED Timer
      const cancelLedCmd = msgStr.match(/^CANCEL_LED_([1-7])_(ON|OFF)$/);
      if (cancelLedCmd) {
        const [, ledId, mode] = cancelLedCmd;
        const key = `led${ledId}_${mode}`;
        if (timers[key]) {
          clearTimeout(timers[key]);
          delete timers[key];
          log(`❌ Cancelled timer for LED_${ledId}_${mode}`);
        } else {
          log(`⚠️ No timer found for LED_${ledId}_${mode}`);
        }
        return;
      }

      // Handle Fan Timer
      const fanTimerCmd = msgStr.match(/^FAN_([1-2])_(ON|OFF)_(\d{2}):(\d{2})$/);
      if (fanTimerCmd) {
        const [, fanId, action, hour, minute] = fanTimerCmd;
        const key = `fan${fanId}_${action}`;
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        const now = new Date();
        if (target <= now) target.setDate(target.getDate() + 1);
        const delay = target - now;

        if (timers[key]) {
          clearTimeout(timers[key]);
          log(`⏰ Cancelled previous timer for ${key}`);
        }

        timers[key] = setTimeout(() => {
          const command = `FAN_${fanId}_${action}`;
          const newState = action === 'ON';
          if (fanStates[`fan${fanId}`] !== newState) {
            fanStates[`fan${fanId}`] = newState;
            log(`⏰ [Timer] Executed: ${command}`);
            broadcastToClients(command, null);
            if (esp32Socket?.readyState === WebSocket.OPEN) esp32Socket.send(command);
          }
          delete timers[key];
        }, delay);

        const timeStr = target.toLocaleTimeString('en-US', { hour12: true });
        log(`⏰ Set timer for FAN_${fanId}_${action} at ${timeStr}`);
        return;
      }

      // Handle Cancel Fan Timer
      const cancelFanCmd = msgStr.match(/^CANCEL_FAN_([1-2])_(ON|OFF)$/);
      if (cancelFanCmd) {
        const [, fanId, mode] = cancelFanCmd;
        const key = `fan${fanId}_${mode}`;
        if (timers[key]) {
          clearTimeout(timers[key]);
          delete timers[key];
          log(`❌ Cancelled timer for FAN_${fanId}_${mode}`);
        } else {
          log(`⚠️ No timer found for FAN_${fanId}_${mode}`);
        }
        return;
      }

      log(`❌ Invalid command from ${source}: ${msgStr}`);
    });

    ws.on('close', () => {
      if (ws === esp32Socket) {
        esp32Socket = null;
        log('❌ ESP32-S3 disconnected');
      } else {
        log('🛑 Web Client disconnected');
      }
    });
  });
}
