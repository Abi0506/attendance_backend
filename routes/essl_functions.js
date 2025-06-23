const express = require('express');
const router = express.Router();
const db = require('../db');
const password = require('./passWord');
const { exec } = require('child_process');
require('dotenv').config();
const scriptPath = process.env.PYTHON_SCRIPT_PATH;


function runPythonScript(args) {
  return new Promise((resolve, reject) => {
    exec(`python "${scriptPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || 'Script failed'));
      resolve(stdout.trim());
    });
  });
}

router.post('/add_user', async (req, res) => {
  let { id, name, dept, category, designation, staff_type, intime, outtime, breakmins, breakin, breakout } = req.body;
  // try {
  //   const pythonResult = await runPythonScript(['set_user_credentials', id, name]);
  //   if (pythonResult.includes('Error')) {
  //     throw new Error(pythonResult);
  //   }
  // } catch (err) {
  //   return res.status(500).json({ success: false, error: err.message });
  // }

  console.log("Category: ", category)
  if (category === -1) {
    console.log("Custom Category processing")
    try {
      const [insertResult] = await db.query(
        `INSERT INTO category (category_description, in_time, out_time, break_in, break_out, break_time_mins) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [staff_type, intime, outtime, breakin, breakout, breakmins]
      );
      category = insertResult.insertId;
    } catch (err) {
      res.status(500).json({ success: false, message: 'Database error' });
    }
  }
  try {
    const plainPassword = id;
    const hashedPassword = await password(plainPassword);
    console.log(category)
    await db.query(
      `INSERT INTO STAFF (staff_id, name, dept, category, password, designation) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, dept, category, hashedPassword, designation]
    );
    res.status(200).json({ success: true, message: `User added successfully` });
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

router.post('/delete_user', async (req, res) => {
  const { id } = req.body;

  if (!/^[A-Za-z]\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  try {
    const pythonResult = await runPythonScript(['delete_user', id]);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
    await db.query(`DELETE FROM STAFF WHERE staff_id = ?`, [id]);
    res.status(200).json({ message: `User ${id} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/delete_logs', async (req, res) => {
  try {
    const pythonResult = await runPythonScript(['delete_logs']);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
    res.status(200).json({ message: 'Logs deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;