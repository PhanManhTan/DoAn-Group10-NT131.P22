// logger.js
const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

const log = console.log;
const error = console.error;
const warn = console.warn;

console.log = (...args) => {
  logStream.write(`[${new Date().toISOString()}] LOG: ${args.join(' ')}\n`);
  log(...args);
};

console.error = (...args) => {
  logStream.write(`[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`);
  error(...args);
};

console.warn = (...args) => {
  logStream.write(`[${new Date().toISOString()}] WARN: ${args.join(' ')}\n`);
  warn(...args);
};
