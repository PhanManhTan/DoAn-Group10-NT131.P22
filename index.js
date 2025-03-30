const express = require('express');
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public'));

// Home route
app.get('/', (req, res) => {
  res.send('<h1>Hello, World! This is a basic Node.js web server using Express!</h1>');
});

// About route
app.get('/about', (req, res) => {
  res.send('<h1>About Us</h1><p>This is a simple web app created using Node.js and Express.</p>');
});

// WebSocket logic
wss.on("connection", (ws) => {
    console.log("New client connected");

    ws.on("message", (message) => {
        console.log(`Received: ${message}`);
        ws.send(`Server received: ${message}`);
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

// Start the server
server.listen(3000, () => {
  console.log('HTTP Server is running on http://localhost:3000');
  console.log('WebSocket Server is running on ws://localhost:3000');
});


// const socket = new WebSocket('ws://localhost:8080');

// socket.onopen = () => {
//     console.log('Connected to WebSocket server');
//     socket.send('Hello Server!');
// };

// socket.onmessage = (event) => {
//     console.log(`Message from server: ${event.data}`);
// };

// socket.onclose = () => {
//     console.log('Disconnected from server');
// };
