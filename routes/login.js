const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;
const db = require('../db');



router.post('/login', async (req, res) => { 

    
    const { userId, password } = req.body;
   
    const [rows] = await db.query('SELECT staff_id, password FROM staff WHERE staff_id = ? AND designation = ?', [userId, 'HR']);
    const user = rows[0];
    console.log(rows);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log("Ok");
    const token = jwt.sign({ staff_id: user.staff_id, }, SECRET_KEY, { expiresIn: '7d' });
   
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });
  
    res.json({ message: 'Logged in successfully' });
  });

  router.get('/check_session', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
  
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      res.clearCookie('token', {
        httpOnly: true,
        secure: false, 
        sameSite: 'lax'
      });
      
      const token = jwt.sign({ staff_id: decoded.staff_id }, SECRET_KEY, { expiresIn: '7d' });
  
      res.cookie('token', token, {
        httpOnly: true,
        secure: false, 
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });
      res.json({ message: 'Valid token' });

    });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax'
    });
    res.json({ message: 'Logged out successfully' });
  });


  module.exports = router;

