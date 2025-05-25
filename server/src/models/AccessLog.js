const mongoose = require('../config'); // 

const accessLogSchema = new mongoose.Schema({
  device:   { type: String, required: true }, // "CỬA"
  method:   { type: String, required: true }, // "PASSWORD", "RFID"
  result:   { type: String, required: true }, // "Success", "Failed"
  time:     { type: Date,   default: Date.now }
}, { collection: 'access_logs' }); // 

const AccessLog = mongoose.model('AccessLog', accessLogSchema);
module.exports = AccessLog;
