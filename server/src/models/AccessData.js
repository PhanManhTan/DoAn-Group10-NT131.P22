
const mongoose = require('mongoose');

// Schema RFID
const RFIDSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: 'UNKNOWN' }
});

// Schema AccessData
const accessDataSchema = new mongoose.Schema({
  password: { type: String, required: true },
  rfidList: [RFIDSchema]
});

const AccessData = mongoose.model('AccessData', accessDataSchema);

module.exports = AccessData;