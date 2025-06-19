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



const loginRouter = require("./routes/login");
const attendanceRouter = require("./routes/attendance");
const esslFunctionsRouter = require("./routes/essl_functions");

app.use("/api", esslFunctionsRouter);
app.use("/api", loginRouter);
app.use("/api", attendanceRouter);


app.listen(PORT,'0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
