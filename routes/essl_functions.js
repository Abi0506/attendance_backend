const express = require('express');
const router = express.Router();
const db = require('../db');
const password = require('./passWord');
const { exec } = require('child_process');
const path = require('path');

const scriptPath = path.join('C:', 'Users', 'lenovo', 'Desktop', 'FaceMachine', 'essl_functions.py');

function runPythonScript(args) {
  return new Promise((resolve, reject) => {
    exec(`python "${scriptPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || 'Script failed'));
      resolve(stdout.trim());
    });
  });
}

router.post('/add_user', async (req, res) => {
  let { id, name, dept, designation, staff_type, working_type, intime, outtime, breakmins, breakin, breakout } = req.body;

  if (!/^[A-Za-z]\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  intime = intime ? `${intime}:00` : null;
  outtime = outtime ? `${outtime}:00` : null;
  breakmins = breakmins || null;
  breakin = breakin ? `${breakin}:00` : null;
  breakout = breakout ? `${breakout}:00` : null;

  try {
    const pythonResult = await runPythonScript(['set_user_credentials', id, name]);
    if (pythonResult.includes('Error')) {
      throw new Error(pythonResult);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    let [rows] = await db.query(
      `SELECT * FROM category WHERE category_description = ? AND in_time = ? AND out_time = ? AND break_in = ? AND break_out = ? AND type = ? AND break_time_mins = ?`,
      [staff_type, intime, outtime, breakin, breakout, working_type, breakmins]
    );

    let category_no;
    if (rows.length === 0) {
      const [insertResult] = await db.query(
        `INSERT INTO category (category_description, in_time, out_time, break_in, break_out, type, break_time_mins) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [staff_type, intime, outtime, breakin, breakout, working_type, breakmins]
      );
      category_no = insertResult.insertId;
    } else {
      category_no = rows[0].category_no;
    }

    const plainPassword = name;
    const hashedPassword = await password(plainPassword);
    await db.query(
      `INSERT INTO STAFF (staff_id, name, dept, designation, password, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, dept, designation, hashedPassword, category_no]
    );
    res.status(200).json({ message: `User ${id} added successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
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