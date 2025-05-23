const wsUrl = (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host + "/";


let ws = null;

function connectWebSocket() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket kết nối thành công!");
    sendInitialStatus();
  };

  ws.onmessage = (event) => {
    console.log("Nhận tin nhắn từ server:", event.data);
    const msgStr = event.data.toString();
    if (msgStr.startsWith("TEMP:")) {
  const temp = msgStr.split(":")[1];
  document.getElementById("temperature").innerText = `${temp} °C`;
} else if (msgStr.startsWith("HUM:")) {
  const hum = msgStr.split(":")[1];
  document.getElementById("humidity").innerText = `${hum} %`;
}


    // Xử lý cập nhật trạng thái đèn
    for (let i = 1; i <= 7; i++) {
      if (msgStr === `LED_${i}_ON`) {
        document.getElementById(`lightToggle${i}`).checked = true;
        document.getElementById(`lightStatus${i}`).textContent = `Trạng thái: Đèn bật`;
        updateToggleAllLightsStatus();
      } else if (msgStr === `LED_${i}_OFF`) {
        document.getElementById(`lightToggle${i}`).checked = false;
        document.getElementById(`lightStatus${i}`).textContent = `Trạng thái: Đèn tắt`;
        updateToggleAllLightsStatus();
      }
    }

    // Xử lý cập nhật trạng thái quạt
    for (let i = 1; i <= 2; i++) {
      if (msgStr === `FAN_${i}_ON`) {
        document.getElementById(`fanToggle${i}`).checked = true;
        document.getElementById(`fanStatus${i}`).textContent = `Trạng thái: Quạt bật`;
      } else if (msgStr === `FAN_${i}_OFF`) {
        document.getElementById(`fanToggle${i}`).checked = false;
        document.getElementById(`fanStatus${i}`).textContent = `Trạng thái: Quạt tắt`;
      }
    }

    // Cập nhật trạng thái cửa
    if (msgStr === "DOOR_OPEN") {
      document.getElementById("doorToggle").checked = true;
      document.getElementById("doorStatus").textContent = `Trạng thái: Mở`;
    } else if (msgStr === "DOOR_CLOSE") {
      document.getElementById("doorToggle").checked = false;
      document.getElementById("doorStatus").textContent = `Trạng thái: Đóng`;
    }

    // Xử lý phản hồi cập nhật mật khẩu
   if (msgStr === "UPDATE_PASSWORD_OK") {
  const status = document.getElementById("passwordUpdateStatus");
  status.style.color = "green";
  status.textContent = "Mật khẩu đã được cập nhật thành công!";
}
else if (msgStr === "UPDATE_PASSWORD_FAIL_OLD_WRONG") {
  const status = document.getElementById("passwordUpdateStatus");
  status.style.color = "red";
  status.textContent = "Mật khẩu cũ không đúng.";
}
else if (msgStr === "UPDATE_PASSWORD_FAIL_EMPTY") {
  const status = document.getElementById("passwordUpdateStatus");
  status.style.color = "red";
  status.textContent = "Mật khẩu mới không được để trống.";
}

  else {
    console.warn("Thông điệp không xác định từ server:", msgStr);
  }
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

function sendInitialStatus() {
  for (let i = 1; i <= 7; i++) {
    const checkbox = document.getElementById(`lightToggle${i}`);
    sendLightStatus(i, checkbox.checked);
  }
  for (let i = 1; i <= 2; i++) {
    const checkbox = document.getElementById(`fanToggle${i}`);
    sendFanStatus(i, checkbox.checked);
  }
  sendDoorStatus(document.getElementById("doorToggle").checked);
}

function sendLightStatus(lightNumber, isOn) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket chưa kết nối, không thể gửi trạng thái đèn.");
    return;
  }
  const message = `LED_${lightNumber}_${isOn ? "ON" : "OFF"}`;
  ws.send(message);
}

function sendFanStatus(fanNumber, isOn) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket chưa kết nối, không thể gửi trạng thái quạt.");
    return;
  }
  const message = `FAN_${fanNumber}_${isOn ? "ON" : "OFF"}`;
  ws.send(message);
}

function sendDoorStatus(isOpen) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket chưa kết nối, không thể gửi trạng thái cửa.");
    return;
  }
  const message = `DOOR_${isOpen ? "OPEN" : "CLOSE"}`;
  ws.send(message);
}

function toggleLight(lightNumber) {
  const checkbox = document.getElementById(`lightToggle${lightNumber}`);
  const statusText = document.getElementById(`lightStatus${lightNumber}`);
  if (checkbox.checked) {
    statusText.textContent = "Trạng thái: Đèn bật";
  } else {
    statusText.textContent = "Trạng thái: Đèn tắt";
  }
  sendLightStatus(lightNumber, checkbox.checked);
  updateToggleAllLightsStatus();
}

function toggleFan(fanNumber) {
  const checkbox = document.getElementById(`fanToggle${fanNumber}`);
  const statusText = document.getElementById(`fanStatus${fanNumber}`);
  if (checkbox.checked) {
    statusText.textContent = "Trạng thái: Quạt bật";
  } else {
    statusText.textContent = "Trạng thái: Quạt tắt";
  }
  sendFanStatus(fanNumber, checkbox.checked);
}

function toggleAllLightsByToggle(isChecked) {
  for (let i = 1; i <= 7; i++) {
    const checkbox = document.getElementById(`lightToggle${i}`);
    checkbox.checked = isChecked;
    toggleLight(i);
  }
  updateAllLightsStatusText(isChecked);
}

function updateToggleAllLightsStatus() {
  let allOn = true;
  for (let i = 1; i <= 7; i++) {
    if (!document.getElementById(`lightToggle${i}`).checked) {
      allOn = false;
      break;
    }
  }
  const toggleAll = document.getElementById("toggleAllLights");
  toggleAll.checked = allOn;
  updateAllLightsStatusText(allOn);
}

function updateAllLightsStatusText(allOn) {
  const statusDiv = document.getElementById("allLightsStatus");
  statusDiv.textContent = allOn ? "Trạng thái: Tất cả đèn bật" : "Trạng thái: Tất cả đèn tắt";
}

function toggleDoor() {
  const checkbox = document.getElementById("doorToggle");
  const statusText = document.getElementById("doorStatus");
  if (checkbox.checked) {
    statusText.textContent = "Trạng thái: Mở";
  } else {
    statusText.textContent = "Trạng thái: Đóng";
  }
  sendDoorStatus(checkbox.checked);
}

function toggleTimer(deviceNumber, mode, deviceType) {
  const timerCheckbox = document.getElementById(`${deviceType.toLowerCase()}TimerToggle${deviceNumber}${mode}`);
  const timeInput = document.getElementById(`${deviceType.toLowerCase()}${mode === "ON" ? "OnTime" : "OffTime"}${deviceNumber}`);
  const isChecked = timerCheckbox.checked;
  const time = timeInput.value.trim();
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (isChecked) {
    if (!time || !timePattern.test(time)) {
      alert(`Vui lòng nhập giờ hợp lệ !`);
      timerCheckbox.checked = false;
      return;
    }
    const message = `${deviceType}_${deviceNumber}_${mode}_${time}`;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      alert(`✅ Đã đặt hẹn giờ ${mode === 'ON' ? 'bật' : 'tắt'} ${deviceType === 'LED' ? 'đèn' : 'quạt'} ${deviceNumber} lúc ${time}`);
    } else {
      alert("⚠️ Không thể kết nối WebSocket. Vui lòng thử lại sau.");
      timerCheckbox.checked = false;
    }
  } else {
    const cancelMessage = `CANCEL_${deviceType}_${deviceNumber}_${mode}`;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(cancelMessage);
      
      alert(`❌ Đã hủy hẹn giờ ${mode === 'ON' ? 'bật' : 'tắt'} cho ${deviceType === 'LED' ? 'đèn' : 'quạt'} ${deviceNumber}`);
    } else {
      alert("⚠️ Không thể kết nối WebSocket. Không thể hủy hẹn giờ.");
    }
    timeInput.value = null;
  }
}



function openPasswordModal() {
  document.getElementById("passwordModal").style.display = "flex";
}

function closePasswordModal() {
  document.getElementById("passwordModal").style.display = "none";
  const statusDiv = document.getElementById("passwordUpdateStatus");
  statusDiv.textContent = "";
  document.getElementById("newDoorPassword").value = "";
  document.getElementById("oldDoorPassword").value = "";
  document.getElementById("confirmNewPassword").value = "";
}

function updateDoorPassword() {
  const oldPassword = document.getElementById("oldDoorPassword").value.trim();
  const newPassword = document.getElementById("newDoorPassword").value.trim();
  const confirmPassword = document.getElementById("confirmNewPassword").value.trim();
  const statusDiv = document.getElementById("passwordUpdateStatus");

  if (!oldPassword || !newPassword || !confirmPassword) {passwordUpdateStatus
    statusDiv.textContent = "Vui lòng nhập đầy đủ mật khẩu.";
    statusDiv.style.color = "red";
    return;
  }

  if (newPassword !== confirmPassword) {
    statusDiv.textContent = "Mật khẩu mới và xác nhận không khớp.";
    statusDiv.style.color = "red";
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = `UPDATE_PASSWORD_${oldPassword}_${newPassword}`;

    ws.send(message);
    statusDiv.textContent = "Đang cập nhật mật khẩu...";
    statusDiv.style.color = "blue";
  } else {
    statusDiv.textContent = "Không thể kết nối đến server.";
    statusDiv.style.color = "red";
  }
}



window.addEventListener("load", () => {
  connectWebSocket();
});