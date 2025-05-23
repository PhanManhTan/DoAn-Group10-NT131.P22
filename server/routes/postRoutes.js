const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../src/config'); 
require('dotenv').config();

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify()
  .then(() => {
    console.log('✅ [SMTP] connected to SMTP server');
  })
  .catch(err => {
    console.error('❌ [SMTP] Fail', err);
  });

// Đăng ký
router.post('/register', async (req, res) => {
    try {
      const { firstName, lastName, userName, gmail, password, confirmPassword } = req.body;
      console.log(`[REGISTER] req:`, { firstName, lastName, userName, gmail, passwordLength: password?.length });
      if (!firstName || !lastName || !userName || !gmail || !password || password !== confirmPassword) {
        console.log(`[REGISTER] ❌ Thiếu hoặc sai thông tin`);
        return res.redirect('/register.html?error=invalid');
      }
      const existsByName = await User.findOne({ userName });
      const existsByGmail = await User.findOne({ gmail });
      if (existsByName || existsByGmail) {
        console.log(`[REGISTER] ❌ Username/Gmail đã tồn tại`);
        return res.send('User already exists. Please choose a different username/email.');
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.create({ firstName, lastName, userName, gmail, password: hashedPassword, createdAt: new Date() });
      console.log(`[REGISTER] ✅ Thành công:`, { firstName, lastName, userName, gmail });
      return res.redirect('/login.html?registered=1');
    } catch (err) {
      console.error('[REGISTER] ❌ Lỗi:', err);
      return res.redirect('/register.html?error=server');
    }
  });
  
  // Đăng nhập
  router.post('/login', async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const user = await User.findOne({
        $or: [{ gmail: identifier.toLowerCase() }, { userName: identifier }]
      });
      if (!user) {
        console.log(`[LOGIN] ❌ Không tìm thấy user:`, identifier);
        return res.redirect('/login.html?error=notfound');
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        console.log(`[LOGIN] ❌ Sai mật khẩu cho user:`, identifier);
        return res.redirect('/login.html?error=wrong');
      }
      req.session.user = { id: user._id, userName: user.userName };
      console.log(`[LOGIN] ✅ Đăng nhập thành công:`, { id: user._id, userName: user.userName });
      return res.redirect('/');
    } catch (err) {
      console.error('[LOGIN] ❌ Lỗi:', err);
      return res.redirect('/login.html?error=server');
    }
  });
  
  // Quên mật khẩu
  router.post('/forgot-password', async (req, res) => {
    const { gmail } = req.body;
    const user = await User.findOne({ gmail });
    if (!user) {
      console.log(`[FORGOT-PASSWORD] ❌ Không tìm thấy user: ${gmail}`);
      return res.redirect('/forgot-password.html?error=notfound');
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOTP = otp;
    user.resetOTPExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();
    await transporter.sendMail({
      from: `"Smart Access" <${process.env.EMAIL_USER}>`,
      to: gmail,
      subject: 'Your OTP Code',
      html: `<p>Your password reset OTP is: <b>${otp}</b></p>`
    });
    console.log(`[FORGOT-PASSWORD] Gửi OTP ${otp} đến ${gmail}`);
    return res.redirect(`/verify-otp.html?email=${encodeURIComponent(gmail)}`);
  });
  
  // Xác thực OTP
  router.post('/verify-otp', async (req, res) => {
    const { gmail, otp } = req.body;
    const user = await User.findOne({ gmail });
    if (!user) {
      console.log(`[VERIFY-OTP] ❌ Không tìm thấy user: ${gmail}`);
      return res.redirect(`/verify-otp.html?error=invalid&email=${encodeURIComponent(gmail)}`);
    }
    if (user.resetOTP !== otp) {
      console.log(`[VERIFY-OTP] ❌ OTP KHÔNG KHỚP cho ${gmail}. Nhập: ${otp}, Đúng: ${user.resetOTP}`);
      return res.redirect(`/verify-otp.html?error=invalid&email=${encodeURIComponent(gmail)}`);
    }
    if (user.resetOTPExpiry < Date.now()) {
      console.log(`[VERIFY-OTP] ❌ OTP HẾT HẠN cho ${gmail}`);
      return res.redirect(`/verify-otp.html?error=invalid&email=${encodeURIComponent(gmail)}`);
    }
    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 60 * 60 * 1000;
    user.resetOTP = undefined;
    user.resetOTPExpiry = undefined;
    await user.save();
    console.log(`[VERIFY-OTP] ✅ Xác thực OTP thành công cho ${gmail}. Token: ${token}`);
    return res.redirect(`/reset-password.html?token=${token}`);
  });
  
  // Đổi mật khẩu mới
  router.post('/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!password || password !== confirmPassword) {
      console.log(`[RESET-PASSWORD] ❌ Không khớp mật khẩu. Token: ${token}`);
      return res.redirect(`/reset-password.html?token=${token}&error=nomatch`);
    }
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });
    if (!user) {
      console.log(`[RESET-PASSWORD] ❌ Token không hợp lệ hoặc hết hạn: ${token}`);
      return res.redirect('/reset-password.html?error=invalid_token');
    }
    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    console.log(`[RESET-PASSWORD] ✅ Đổi mật khẩu thành công cho user: ${user.userName}`);
    return res.redirect('/login.html?reset=success');
  });
  

module.exports = router;
