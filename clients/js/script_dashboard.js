// Biến trạng thái thiết bị hiện tại trên client
let ledStates = Array(7).fill(false);  // 7 đèn
let fanStates = Array(2).fill(false);  // 2 quạt
let doorState = false;

// Hàm xử lý tin nhắn từ server dành cho dashboard
function dashboard_onMessage(msgStr) {
  // Cập nhật trạng thái đèn
  for (let i = 1; i <= 7; i++) {
    if (msgStr === `LED_${i}_ON`) {
      ledStates[i - 1] = true;
      updateDashboardUI();
      return;
    } else if (msgStr === `LED_${i}_OFF`) {
      ledStates[i - 1] = false;
      updateDashboardUI();
      return;
    }
  }

  // Cập nhật trạng thái quạt
  for (let i = 1; i <= 2; i++) {
    if (msgStr === `FAN_${i}_ON`) {
      fanStates[i - 1] = true;
      updateDashboardUI();
      return;
    } else if (msgStr === `FAN_${i}_OFF`) {
      fanStates[i - 1] = false;
      updateDashboardUI();
      return;
    }
  }

  // Cập nhật trạng thái cửa
  if (msgStr === "DOOR_OPEN") {
    doorState = true;
    updateDashboardUI();
  } else if (msgStr === "DOOR_CLOSE") {
    doorState = false;
    updateDashboardUI();
  }
}

// Cập nhật UI dashboard theo trạng thái hiện tại
function updateDashboardUI() {
  // Đèn
  const toggleDen = document.getElementById("toggleDen");
  if (toggleDen) toggleDen.checked = ledStates.every(state => state === true);

  const ledOnCount = ledStates.filter(state => state === true).length;
  const denStatusCell = toggleDen?.closest('tr')?.querySelector('td:nth-child(2)');
  if (denStatusCell) denStatusCell.textContent = `${ledOnCount} / 7 On`;

  // Quạt
  const toggleQuat = document.getElementById("toggleQuat");
  if (toggleQuat) toggleQuat.checked = fanStates.every(state => state === true);

  const fanOnCount = fanStates.filter(state => state === true).length;
  const quatStatusCell = toggleQuat?.closest('tr')?.querySelector('td:nth-child(2)');
  if (quatStatusCell) quatStatusCell.textContent = `${fanOnCount} / 2 On`;

  // Cửa
  const toggleCua = document.getElementById("toggleCua");
  if (toggleCua) toggleCua.checked = doorState;

  const cuaStatusCell = toggleCua?.closest('tr')?.querySelector('td:nth-child(2)');
  if (cuaStatusCell) cuaStatusCell.textContent = doorState ? "On" : "Off";
}

// Gửi trạng thái đèn đến server
function sendLightStatusAll(isOn) {
  for (let i = 1; i <= 7; i++) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(`LED_${i}_${isOn ? "ON" : "OFF"}`);
    }
  }
}

// Gửi trạng thái quạt đến server
function sendFanStatusAll(isOn) {
  for (let i = 1; i <= 2; i++) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(`FAN_${i}_${isOn ? "ON" : "OFF"}`);
    }
  }
}

// Gửi trạng thái cửa đến server
function sendDoorStatus(isOpen) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(`DOOR_${isOpen ? "OPEN" : "CLOSE"}`);
  }
}

// Sự kiện khi toggle tổng đèn bị thay đổi
document.getElementById("toggleDen")?.addEventListener("change", (e) => {
  const isChecked = e.target.checked;
  sendLightStatusAll(isChecked);
  // Cập nhật UI ngay lập tức khi user thao tác
  ledStates.fill(isChecked);
  updateDashboardUI();
});

// Sự kiện khi toggle tổng quạt bị thay đổi
document.getElementById("toggleQuat")?.addEventListener("change", (e) => {
  const isChecked = e.target.checked;
  sendFanStatusAll(isChecked);
  fanStates.fill(isChecked);
  updateDashboardUI();
});

// Sự kiện khi toggle cửa bị thay đổi
document.getElementById("toggleCua")?.addEventListener("change", (e) => {
  const isChecked = e.target.checked;
  sendDoorStatus(isChecked);
  doorState = isChecked;
  updateDashboardUI();
});

// Đăng ký callback xử lý tin nhắn
registerOnMessageCallback(dashboard_onMessage);
