// server/src/models/User.js
const mongoose = require('../config'); // lấy instance đã connect ở trên

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  userName: { type: String, required: true, unique: true },
  gmail:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  resetOTP: String,
  resetOTPExpiry: Date,
  resetToken: String,
  resetTokenExpiry: Date
});

const User = mongoose.model('User', userSchema);

module.exports = User;
