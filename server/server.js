// server/server.js

const express = require('express');
const path    = require('path');
const http    = require('http');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// 1) Định nghĩa đường dẫn đến folder clients
const CLIENTS_DIR = path.join(__dirname, '..', 'clients');

// 2) Serve tất cả file tĩnh trong clients/
//    Ví dụ: clients/index.html, clients/css/..., clients/js/...
app.use(express.static(CLIENTS_DIR));

// 3) Route cho trang chính và about (nếu có about.html trong clients/)
app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENTS_DIR, 'index.html'));
});
app.get('/about', (req, res) => {
  res.sendFile(path.join(CLIENTS_DIR, 'about.html'));
});

// 4) WebSocket logic
wss.on('connection', (ws) => {
  console.log('New WS client connected');

  ws.on('message', (msg) => {
    console.log('Received:', msg);
    ws.send(`Server received: ${msg}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.send('Kết nối WS thành công!');
});

// 5) Khởi server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP & WS chạy tại http://localhost:${PORT}`);
});
