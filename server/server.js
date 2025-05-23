const express = require('express');
const http = require('http');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
const routes = require('./routes');
app.use('/', routes);

const CLIENTS_DIR = path.join(__dirname, '..', 'clients');
app.use(express.static(CLIENTS_DIR));
app.use((req, res) => res.status(404).sendFile(path.join(CLIENTS_DIR, '404.html')));

// Gắn WebSocket
const setupWebSocket = require('./socket_server'); // Đảm bảo đường dẫn đúng
setupWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP & WS chạy tại http://localhost:${PORT}`);
  // Các log IP như bạn đã có
});
