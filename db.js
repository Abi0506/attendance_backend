// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'sql304.infinityfree.com',
  user: 'if0_39320826',
  password: 'Cookies@12', // Replace with your actual password
  database: 'if0_39320826_faculty_data_logs',
  port: 3306,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
