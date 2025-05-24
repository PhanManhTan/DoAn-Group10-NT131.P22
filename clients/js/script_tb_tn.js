// Hàm xử lý tin nhắn server riêng cho trang tb_tn.html
function tb_tn_onMessage(msgStr) {
  // Cập nhật nhiệt độ, độ ẩm
  if (msgStr.startsWith("TEMP:")) {
    const temp = msgStr.split(":")[1];
    const el = document.getElementById("temperature");
    if (el) el.innerText = `${temp} °C`;
  } else if (msgStr.startsWith("HUM:")) {
    const hum = msgStr.split(":")[1];
    const el = document.getElementById("humidity");
    if (el) el.innerText = `${hum} %`;
  }

  // Cập nhật trạng thái đèn
  for (let i = 1; i <= 7; i++) {
    if (msgStr === `LED_${i}_ON`) {
      const cb = document.getElementById(`lightToggle${i}`);
      const statusText = document.getElementById(`lightStatus${i}`);
      if (cb) cb.checked = true;
      if (statusText) statusText.textContent = `Trạng thái: Đèn bật`;
      updateToggleAllLightsStatus();
    } else if (msgStr === `LED_${i}_OFF`) {
      const cb = document.getElementById(`lightToggle${i}`);
      const statusText = document.getElementById(`lightStatus${i}`);
      if (cb) cb.checked = false;
      if (statusText) statusText.textContent = `Trạng thái: Đèn tắt`;
      updateToggleAllLightsStatus();
    }
  }

  // Cập nhật trạng thái quạt
  for (let i = 1; i <= 2; i++) {
    if (msgStr === `FAN_${i}_ON`) {
      const cb = document.getElementById(`fanToggle${i}`);
      const statusText = document.getElementById(`fanStatus${i}`);
      if (cb) cb.checked = true;
      if (statusText) statusText.textContent = `Trạng thái: Quạt bật`;
    } else if (msgStr === `FAN_${i}_OFF`) {
      const cb = document.getElementById(`fanToggle${i}`);
      const statusText = document.getElementById(`fanStatus${i}`);
      if (cb) cb.checked = false;
      if (statusText) statusText.textContent = `Trạng thái: Quạt tắt`;
    }
  }

  // Cập nhật trạng thái cửa
  if (msgStr === "DOOR_OPEN") {
    const cb = document.getElementById("doorToggle");
    const statusText = document.getElementById("doorStatus");
    if (cb) cb.checked = true;
    if (statusText) statusText.textContent = `Trạng thái: Mở`;
  } else if (msgStr === "DOOR_CLOSE") {
    const cb = document.getElementById("doorToggle");
    const statusText = document.getElementById("doorStatus");
    if (cb) cb.checked = false;
    if (statusText) statusText.textContent = `Trạng thái: Đóng`;
  }

  // Xử lý phản hồi cập nhật mật khẩu
  if (msgStr === "UPDATE_PASSWORD_OK") {
    const status = document.getElementById("passwordUpdateStatus");
    if (status) {
      status.style.color = "green";
      status.textContent = "Mật khẩu đã được cập nhật thành công!";
    }
  } else if (msgStr === "UPDATE_PASSWORD_FAIL_OLD_WRONG") {
    const status = document.getElementById("passwordUpdateStatus");
    if (status) {
      status.style.color = "red";
      status.textContent = "Mật khẩu cũ không đúng.";
    }
  } else if (msgStr === "UPDATE_PASSWORD_FAIL_EMPTY") {
    const status = document.getElementById("passwordUpdateStatus");
    if (status) {
      status.style.color = "red";
      status.textContent = "Mật khẩu mới không được để trống.";
    }
  }
}

// Đăng ký callback xử lý tin nhắn từ server khi load file này
registerOnMessageCallback(tb_tn_onMessage);

// --- Các hàm xử lý UI & sự kiện ---

function toggleLight(lightNumber) {
  const checkbox = document.getElementById(`lightToggle${lightNumber}`);
  const statusText = document.getElementById(`lightStatus${lightNumber}`);
  if (!checkbox || !statusText) return;

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
  if (!checkbox || !statusText) return;

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
    if (!checkbox) continue;
    checkbox.checked = isChecked;
    toggleLight(i);
  }
  updateAllLightsStatusText(isChecked);
}

function updateToggleAllLightsStatus() {
  let allOn = true;
  for (let i = 1; i <= 7; i++) {
    const checkbox = document.getElementById(`lightToggle${i}`);
    if (!checkbox || !checkbox.checked) {
      allOn = false;
      break;
    }
  }
  const toggleAll = document.getElementById("toggleAllLights");
  if (toggleAll) toggleAll.checked = allOn;
  updateAllLightsStatusText(allOn);
}

function updateAllLightsStatusText(allOn) {
  const statusDiv = document.getElementById("allLightsStatus");
  if (!statusDiv) return;
  statusDiv.textContent = allOn ? "Trạng thái: Tất cả đèn bật" : "Trạng thái: Tất cả đèn tắt";
}

function toggleDoor() {
  const checkbox = document.getElementById("doorToggle");
  const statusText = document.getElementById("doorStatus");
  if (!checkbox || !statusText) return;

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

  if (!timerCheckbox || !timeInput) return;

  const isChecked = timerCheckbox.checked;
  const time = timeInput.value.trim();
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (isChecked) {
    if (!time || !timePattern.test(time)) {
      alert("Vui lòng nhập giờ hợp lệ !");
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
  const modal = document.getElementById("passwordModal");
  if (modal) modal.style.display = "flex";
}

function closePasswordModal() {
  const modal = document.getElementById("passwordModal");
  if (modal) modal.style.display = "none";

  const statusDiv = document.getElementById("passwordUpdateStatus");
  if (statusDiv) statusDiv.textContent = "";

  const newPw = document.getElementById("newDoorPassword");
  const oldPw = document.getElementById("oldDoorPassword");
  const confirmPw = document.getElementById("confirmNewPassword");
  if (newPw) newPw.value = "";
  if (oldPw) oldPw.value = "";
  if (confirmPw) confirmPw.value = "";
}

function updateDoorPassword() {
  const oldPassword = document.getElementById("oldDoorPassword")?.value.trim();
  const newPassword = document.getElementById("newDoorPassword")?.value.trim();
  const confirmPassword = document.getElementById("confirmNewPassword")?.value.trim();
  const statusDiv = document.getElementById("passwordUpdateStatus");

  if (!oldPassword || !newPassword || !confirmPassword) {
    if (statusDiv) {
      statusDiv.textContent = "Vui lòng nhập đầy đủ mật khẩu.";
      statusDiv.style.color = "red";
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (statusDiv) {
      statusDiv.textContent = "Mật khẩu mới và xác nhận không khớp.";
      statusDiv.style.color = "red";
    }
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = `UPDATE_PASSWORD_${oldPassword}_${newPassword}`;
    ws.send(message);
    if (statusDiv) {
      statusDiv.textContent = "Đang cập nhật mật khẩu...";
      statusDiv.style.color = "blue";
    }
  } else {
    if (statusDiv) {
      statusDiv.textContent = "Không thể kết nối đến server.";
      statusDiv.style.color = "red";
    }
  }
}
