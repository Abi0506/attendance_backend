// app.js
const express = require("express");
const cookieParser = require('cookie-parser');

const cors = require("cors");
const app = express();

const PORT = 5000;
const corsOptions = {
  origin: 'http://localhost:3000', 
  credentials: true,              
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


const mainRouer = require("./routes/main");
const loginRouter = require("./routes/login");
const attendanceRouter = require("./routes/attendance");

app.use("/", mainRouer);
app.use("/api", loginRouter);
app.use("/api", attendanceRouter);
// const bcrypt = require('bcryptjs');

// // Simulate stored hash in the database
// let storedHash = null;
// bcrypt.hash('I0215', 10, (err, hash) => {
//   if (err) {
//     console.error('Error hashing password:', err);
//     return;
//   }
//   storedHash = hash;
//   const inputPassword = 'I0215';
//   console.log('Input password:', storedHash);
// bcrypt.compare(inputPassword, '$2b$10$vqI/V7zF7v1EM8ES8mP7Ne01TM/polzcC2JVIllMubXyVlepBfNzG', (err, isMatch) => {
//   if (err) throw err;
//   if (isMatch) {
//     console.log('✅ Password is correct!');
//   } else {
//     console.log('❌ Incorrect password.');
//   }
// });
// });
// Login input

app.listen(PORT,'0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
