// server/src/models/User.js

const mongoose = require('mongoose');
const connect = mongoose.connect('mongodb://localhost:27017/myapp'); // Kết nối đến MongoDB

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true }, // lưu bcrypt hash
  createdAt: { type: Date,   default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
