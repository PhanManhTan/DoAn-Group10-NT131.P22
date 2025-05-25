// server/src/config.js
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/login-tut', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully!'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// CHỈ EXPORT mongoose!
module.exports = mongoose;
