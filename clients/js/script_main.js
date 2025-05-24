const wsUrl = (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host + "/";
let ws = null;
const messageCallbacks = [];

function connectWebSocket() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket kết nối thành công!");
  };

  ws.onmessage = (event) => {
    // Gọi tất cả callback đăng ký
    messageCallbacks.forEach(cb => {
      try {
        cb(event.data);
      } catch(e) {
        console.error("Lỗi callback xử lý message:", e);
      }
    });
  };

  ws.onerror = (err) => {
    console.error("Lỗi WebSocket:", err);
    alert("Lỗi kết nối WebSocket. Vui lòng kiểm tra kết nối mạng.");
  };

  ws.onclose = () => {
    console.warn("WebSocket đóng kết nối, thử lại sau 5 giây...");
    setTimeout(connectWebSocket, 5000);
  };
}

function registerOnMessageCallback(fn) {
  if (typeof fn === "function") {
    messageCallbacks.push(fn);
  }
}

// Gửi trạng thái thiết bị lúc mới kết nối
function sendInitialStatus() {
  // Đèn
  for (let i = 1; i <= 7; i++) {
    const checkbox = document.getElementById(`lightToggle${i}`);
    if (checkbox) sendLightStatus(i, checkbox.checked);
  }
  // Quạt
  for (let i = 1; i <= 2; i++) {
    const checkbox = document.getElementById(`fanToggle${i}`);
    if (checkbox) sendFanStatus(i, checkbox.checked);
  }
  // Cửa
  const doorToggle = document.getElementById("doorToggle");
  if (doorToggle) sendDoorStatus(doorToggle.checked);
}

function sendLightStatus(lightNumber, isOn) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket chưa kết nối, không thể gửi trạng thái đèn.");
    return;
  }
  ws.send(`LED_${lightNumber}_${isOn ? "ON" : "OFF"}`);
}

function sendFanStatus(fanNumber, isOn) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket chưa kết nối, không thể gửi trạng thái quạt.");
    return;
  }
  ws.send(`FAN_${fanNumber}_${isOn ? "ON" : "OFF"}`);
}

function sendDoorStatus(isOpen) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket chưa kết nối, không thể gửi trạng thái cửa.");
    return;
  }
  ws.send(`DOOR_${isOpen ? "OPEN" : "CLOSE"}`);
}

window.addEventListener("load", () => {
  connectWebSocket();
});

// Expose hàm đăng ký callback và ws lên window để gọi từ file khác
window.registerOnMessageCallback = registerOnMessageCallback;
window.ws = ws;
window.sendLightStatus = sendLightStatus;
window.sendFanStatus = sendFanStatus;
window.sendDoorStatus = sendDoorStatus;
