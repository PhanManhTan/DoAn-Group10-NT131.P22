const express = require('express');
const path = require('path');
const router = express.Router();

const CLIENTS_DIR = path.join(__dirname, '..', '..', 'clients');
const PUBLIC_PATHS = [
  '/login', '/login.html',
  '/register', '/register.html',
  '/forgot-password', '/forgot-password.html',
  '/verify-otp', '/verify-otp.html',
  '/reset-password', '/reset-password.html'
];

// Middleware bảo vệ route GET
router.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (
    PUBLIC_PATHS.includes(req.path) ||
    req.session.user ||
    ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff2', '.woff', '.ttf', '.map'].includes(ext)
  ) return next();
  return res.redirect('/login');
});

// Trang chính sau đăng nhập
router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(CLIENTS_DIR, 'index.html'));
});

router.get('/history', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(CLIENTS_DIR, 'history.html'));
});

router.get('/tb_tn', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(CLIENTS_DIR, 'tb_tn.html'));
});

router.get('/login', (req, res) => res.sendFile(path.join(CLIENTS_DIR, 'login.html')));
router.get('/register', (req, res) => res.sendFile(path.join(CLIENTS_DIR, 'register.html')));
router.get('/forgot-password', (req, res) => res.sendFile(path.join(CLIENTS_DIR, 'forgot-password.html')));
router.get('/verify-otp', (req, res) => res.sendFile(path.join(CLIENTS_DIR, 'verify-otp.html')));
router.get('/reset-password', (req, res) => res.sendFile(path.join(CLIENTS_DIR, 'reset-password.html')));


module.exports = router;
