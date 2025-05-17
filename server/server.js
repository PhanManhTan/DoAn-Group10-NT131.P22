// server/server.js

const express = require('express');
const path    = require('path');
const http    = require('http');
const WebSocket = require('ws');
const bcrypt  = require('bcrypt');
const crypto      = require('crypto');
const nodemailer  = require('nodemailer');
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
require('dotenv').config(); 

// Import Mongoose model (config.js connects to MongoDB)
const User      = require('./src/config');

// Middleware: parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static UI files from "clients/"
const CLIENTS_DIR = path.join(__dirname, '..', 'clients');
app.use(express.static(CLIENTS_DIR));


//test login
app.get('/login', (req, res) => {
  res.sendFile(path.join(CLIENTS_DIR, 'login.html'));
});

//test register
app.get('/register', (req, res) => {
  res.sendFile(path.join(CLIENTS_DIR, 'register.html'));
});


// Register User
app.post('/register', async (req, res) => {
  try {
    // 1) Lấy dữ liệu từ form
    const {
      firstName,
      lastName,
      userName,
      gmail,
      password,
      confirmPassword
    } = req.body;

    // 2) Validate cơ bản
    if (!firstName || !lastName || !userName || !gmail || !password || password !== confirmPassword) {
      return res.redirect('/register.html?error=invalid');
    }

    // 3) Kiểm xem userName hoặc gmail đã tồn tại
    const existsByName  = await User.findOne({ userName });
    const existsByGmail = await User.findOne({ gmail });
    if (existsByName || existsByGmail) {
      // bạn có thể check riêng biệt để redirect đúng ?error=username_exists hoặc ?error=email_exists
      return res.send('User already exists. Please choose a different username/email.');
    }

    // 4) Hash password
    const saltRounds      = 10;
    const hashedPassword  = await bcrypt.hash(password, saltRounds);

    // 5) Tạo user mới
    const newUser = await User.create({
      firstName,
      lastName,
      userName,
      gmail,
      password: hashedPassword,
      createdAt: new Date()
    });
    console.log('New user created:', newUser);

    // 6) Redirect về login
    return res.redirect('/login.html?registered=1');
  } catch (err) {
    console.error('Register error:', err);
    return res.redirect('/register.html?error=server');
  }
});

// Login user
app.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // tìm user theo email hoặc username
    const user = await User.findOne({
      $or: [
        { gmail: identifier.toLowerCase() },
        { userName: identifier }
      ]
    });

    if (!user) {
      return res.redirect('/login.html?error=notfound');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.redirect('/login.html?error=wrong');
    }

    // Nếu dùng session:
    // req.session.user = { id: user._id, userName: user.userName };

    // Redirect về trang chính
    return res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    return res.redirect('/login.html?error=server');
  }
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



// transporter dùng Gmail SMTP (app password)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


transporter.verify().then(() => {
  console.log('✅ SMTP is ready');
}).catch(err => {
  console.error('❌ SMTP verify failed', err);
});

app.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (!password || password !== confirmPassword) {
    return res.redirect(`/reset-password.html?token=${token}&error=invalid`);
  }

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() }
  });
  if (!user) {
    return res.redirect('/reset-password.html?error=invalid_token');
  }

  // Hash và cập nhật password
  user.password = await bcrypt.hash(password, 10);
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  res.redirect('/login.html?reset=success');
});

// --- Forgot Password: request OTP ---
app.post('/forgot-password', async (req, res) => {
  const { gmail } = req.body;
  const user = await User.findOne({ gmail });
  if (!user) {
    return res.redirect('/forgot-password.html?error=notfound');
  }
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetOTP = otp;
  user.resetOTPExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  // Send OTP via email
  await transporter.sendMail({
    from: `"Smart Access" <${process.env.EMAIL_USER}>`,
    to: gmail,
    subject: 'Your OTP Code',
    html: `<p>Your password reset OTP is: <b>${otp}</b></p>`
  });

  // Redirect to OTP verification page
  return res.redirect(`/verify-otp.html?email=${encodeURIComponent(gmail)}`);
});

// --- Verify OTP ---
app.post('/verify-otp', async (req, res) => {
  console.log('VERIFY OTP body:', req.body);
  const { gmail, otp } = req.body;
  const user = await User.findOne({ gmail });
  if (!user || user.resetOTP !== otp || user.resetOTPExpiry < Date.now()) {
    return res.redirect(`/verify-otp.html?error=invalid&email=${encodeURIComponent(gmail)}`);
  }
  // OTP hợp lệ → sinh resetToken và redirect
  const token = crypto.randomBytes(20).toString('hex');
  user.resetToken = token;
  user.resetTokenExpiry = Date.now() + 60*60*1000;
  user.resetOTP = undefined;
  user.resetOTPExpiry = undefined;
  await user.save();
  return res.redirect(`/reset-password.html?token=${token}`);
});

// --- Reset Password ---
app.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (!password || password !== confirmPassword) {
    return res.redirect(`/reset-password.html?token=${token}&error=nomatch`);
  }
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() }
  });
  if (!user) {
    return res.redirect('/reset-password.html?error=invalid_token');
  }
  user.password = await bcrypt.hash(password, 10);
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();
  return res.redirect('/login.html?reset=success');
});

// 5) Khởi server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP & WS chạy tại http://localhost:${PORT}`);
});
