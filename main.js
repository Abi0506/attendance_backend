// app.js
const express = require("express");
const cookieParser = require('cookie-parser');
const cors = require("cors");
const app = express();

const corsOptions = {
  origin: true, // Allow all origins for testing; restrict in production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());



const loginRouter = require("./routes/login");
const attendanceRouter = require("./routes/attendance");
const esslFunctionsRouter = require("./routes/essl_functions");

app.use("/api", esslFunctionsRouter);
app.use("/api", loginRouter);
app.use("/api", attendanceRouter);

// Export the app for Vercel serverless deployment
module.exports = app;
