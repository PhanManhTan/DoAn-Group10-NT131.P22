### Prepare environment to run this code

#### Run the following commands in the terminal:

```
cd server
npm install
```

#### Then create a .env file for SMTP configuration:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/smart_access
SESSION_SECRET=changethis_in_production
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=YOUR_EMAIL
EMAIL_PASS=YOUR_APP_PASSWORD
BASE_URL=http://localhost:3000
```

**Note: You must generate an App Password from your Google account after enabling 2FA to use as EMAIL_PASS.**

### About the database (MongoDB)

#### In the file src/config.js, locate the following lines:

```
mongoose.connect('mongodb://localhost:27017/login-tut', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
```

_Change the database URL to match your MongoDB database connection string._
