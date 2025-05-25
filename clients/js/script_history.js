document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.querySelector("#historyTable tbody");
    const searchInput = document.getElementById("historySearch");
    let allLogs = [];
  
    async function fetchLogs() {
      const res = await fetch("/api/access-logs");
      return res.json();
    }
  
    function renderLogs(logs) {
      tableBody.innerHTML = "";
      logs.forEach(log => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${log.device || ""}</td>
          <td>${log.method === "PASSWORD" ? "Mật khẩu" : "RFID"}</td>
          <td>
            <span class="text-${log.result === "Success" ? "success" : "danger"}">
              ${log.result === "Success" ? "Thành công" : "Thất bại"}
            </span>
          </td>
          <td>${formatTime(log.time)}</td>
        `;
        tableBody.appendChild(row);
      });
    }
  
    function formatTime(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
  
    // Tìm kiếm theo input
    searchInput.addEventListener("input", () => {
      const searchVal = searchInput.value.trim().toLowerCase();
      let logs = allLogs;
      if (searchVal) {
        logs = allLogs.filter(l =>
          (l.device || "").toLowerCase().includes(searchVal) ||
          (l.method === "PASSWORD" ? "mật khẩu" : "rfid").includes(searchVal) ||
          (l.result === "Success" ? "thành công" : "thất bại").includes(searchVal)
        );
      }
      renderLogs(logs);
    });
  
    // Load mặc định
    allLogs = await fetchLogs();
    renderLogs(allLogs);
  
    // Gọi hàm renderRecentAccess để nhóm theo hôm nay, hôm qua (phần kế tiếp)
    renderRecentAccess(allLogs);
  });
  
  async function loadRecentAccess() {
    const res = await fetch('/api/logs/recent');
    const logs = await res.json();

    // Tách hôm nay/hôm qua
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();

    const todayLogs = [];
    const yesterdayLogs = [];

    logs.forEach(log => {
        const logDate = new Date(log.time);
        const logDateStr = logDate.toLocaleDateString();

        if (logDateStr === todayStr) todayLogs.push(log);
        else if (logDateStr === yesterdayStr) yesterdayLogs.push(log);
    });

    // Render hôm nay
    const todayList = document.querySelector('#recent-access-today');
    todayList.innerHTML = todayLogs.length === 0 ? '<li>Không có lượt truy cập</li>' :
      todayLogs.map(renderLogItem).join('');

    // Render hôm qua
    const yesterdayList = document.querySelector('#recent-access-yesterday');
    yesterdayList.innerHTML = yesterdayLogs.length === 0 ? '<li>Không có lượt truy cập</li>' :
      yesterdayLogs.map(renderLogItem).join('');
}

function renderLogItem(log) {
    // Badge màu và icon theo trạng thái
    const isSuccess = log.result === 'Success' || log.result === 'Thành công';
    const icon = isSuccess
        ? '<i class="fas fa-check-circle fa-lg text-success mr-2"></i>'
        : '<i class="fas fa-times-circle fa-lg text-danger mr-2"></i>';
    const statusSpan = isSuccess
        ? '<span class="text-success font-weight-bold">Thành công</span>'
        : '<span class="text-danger font-weight-bold">Thất bại</span>';
    const method = log.method === 'PASSWORD' ? 'Mật khẩu'
                 : log.method === 'RFID' ? 'RFID'
                 : (log.method || '');

    const time = new Date(log.time);
    // Format ngày: "7 May 2025, at 12:30 PM"
    const timeStr = time.toLocaleString('vi-VN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    return `
    <li class="d-flex justify-content-between align-items-center py-2 border-top">
      <div>
        ${icon}
        <strong>${log.device || 'Cửa'}</strong><br>
        <small class="text-secondary">Loại: ${method}</small><br>
        <small class="text-secondary">${timeStr.replace(',', '')}</small>
      </div>
      ${statusSpan}
    </li>`;
}

// Gán id cho ul trong file html:
document.addEventListener('DOMContentLoaded', () => {
    loadRecentAccess();
});
