// server/src/config.js

const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/login-tut', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  firstName:        { type: String, required: true },
  lastName:         { type: String, required: true },
  userName:         { type: String, required: true, unique: true },
  gmail:            { type: String, required: true, unique: true },
  password:         { type: String, required: true },
  createdAt:        { type: Date,   default: Date.now },

  // Fields for password reset
  resetOTP:         { type: String },
  resetOTPExpiry:   { type: Date },
  resetToken:       { type: String },
  resetTokenExpiry: { type: Date }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
