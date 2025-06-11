const express = require('express');
const router = express.Router();
const db = require('../db');

async function start_end_time() {
  const today = new Date();
  const year = today.getFullYear();


  if (today < new Date(`${year}-06-01`)) {
    return [`${year}-01-01`, today.toISOString().split('T')[0]];
  } else {
    return [`${year}-06-01`, today.toISOString().split('T')[0]];
  }
}

async function absent_marked(summary) {
  let leaves = 0;
  let num = Number(summary);
  let num1 = num;
  if (num >= 360) {

    num = num - 360;
    leaves += 0.5;

    for (let i = num; i > 240; i -= 240) {
      leaves += 0.5;


    }
  }
  return [leaves, num1];
}

router.post('/attendance_viewer', async (req, res) => {
  const { date } = req.body;


  const parts = date.split('-');


  try {
    const [rows] = await db.query(`SELECT logs.staff_id, logs.time,staff.name FROM staff JOIN logs ON staff.staff_id = logs.staff_id WHERE date = ? ORDER BY time  `, [date]);
    let name = "";
    const categorized = {};
    for (const row of rows) {
      const { staff_id, name, time } = row;

      if (!categorized[staff_id]) {
        categorized[staff_id] = { name: name, times: [] };
      }
      categorized[staff_id].times.push(time);
    }
    const result = Object.entries(categorized).map(([staff_id, { name, times }]) => {
      return {
        staff_id: staff_id,
        name: name,
        IN1: times[0] || null,
        OUT1: times[1] || null,
        IN2: times[2] || null,
        OUT2: times[3] || null,
        IN3: times[4] || null,
        OUT3: times[5] || null,
      };
    });
    res.json(result);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



router.post('/dept_summary', async (req, res) => {
  let rows = [];
  const [startDate, endDate] = await start_end_time();

  const { dept } = req.body;

  if (dept === 'ALL') {
    [rows] = await db.query(`
      SELECT 
        staff.staff_id,
        staff.name,
        staff.dept,
        SUM(report.late_mins) AS summary
      FROM 
        report
      JOIN 
        staff ON staff.staff_id = report.staff_id
      WHERE 
        report.date BETWEEN ? AND ?
      GROUP BY 
        staff.dept, staff.staff_id, staff.name
      ORDER BY 
        staff.dept, staff.staff_id
    `, [startDate, endDate]);
  } else {
    [rows] = await db.query(`
      SELECT 
        staff.staff_id,
        staff.name,
        staff.dept,
        SUM(report.late_mins) AS summary
      FROM 
        report
      JOIN 
        staff ON staff.staff_id = report.staff_id
      WHERE 
        report.date BETWEEN ? AND ? AND staff.dept = ?
      GROUP BY 
        staff.dept, staff.staff_id, staff.name
      ORDER BY 
        staff.dept, staff.staff_id
    `, [startDate, endDate, dept]);
  }
  let result = {};
  for (const row of rows) {

    let { dept, summary, ...rest } = row;
    let [leaves, num1] = await absent_marked(summary);
    let entry = {
      ...rest,
      summary: num1,
      leaves: leaves
    };
    if (!result[dept]) {
      result[dept] = [];
    }
    result[dept].push(entry);
  }
  const start_Date = startDate.split('-').reverse().join('-');
  const end_Date = endDate.split('-').reverse().join('-');
  let finalResult = { date: [start_Date, end_Date], data: result };

  res.json(finalResult);
});

router.post('/individual_data', async (req, res) => {

  function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function minutesToHHMM(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs != 1)
      return `${hrs.toString().padStart(2, '0')}hrs ${mins.toString().padStart(2, '0')}mins `;

    else return `${hrs.toString().padStart(2, '0')}hr ${mins.toString().padStart(2, '0')}mins `;
  }

  const { start_date, end_date, id } = req.body;
  const [start, end] = await start_end_time();
  try {
    const [rows] = await db.query(`
      SELECT 
        logs.date,
        logs.time
      FROM 
        logs 
      WHERE 
        logs.date BETWEEN ? AND ?
        AND logs.staff_id = ?
      ORDER BY 
        logs.date, logs.time;
    `, [start_date, end_date, id]);


    const [staffInfo] = await db.query(`
      SELECT 
        staff.name,
        staff.dept,
        staff.category
      FROM
        staff
      WHERE 
        staff.staff_id = ?
    `, [id]);

    const [late_mins] = await db.query(`
      SELECT 
        late_mins,
        date
      FROM
        report
      WHERE
        staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start_date, end_date]);

    let [total_late_mins] = await db.query(`
      SELECT  
        SUM(late_mins) AS total_late_mins
      FROM
        report
      WHERE
        staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start, end]);

    if (staffInfo.length === 0) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No attendance records found for the given date range.' });
    }


    const groupedByDate = {};

    for (const row of rows) {
      if (!groupedByDate[row.date]) {
        groupedByDate[row.date] = [];
      }
      groupedByDate[row.date].push(row.time);
    }

    const result = [];

    for (const [date, times] of Object.entries(groupedByDate)) {

      times.sort();
      const row = { date };
      let totalMinutes = 0;

      for (let i = 0; i < 3; i++) {

        row[`IN${i + 1}`] = times[i * 2] || null;
        row[`OUT${i + 1}`] = times[i * 2 + 1] || null;

        if (row[`IN${i + 1}`] && row[`OUT${i + 1}`]) {
          const inMin = parseTimeToMinutes(row[`IN${i + 1}`]);
          const outMin = parseTimeToMinutes(row[`OUT${i + 1}`]);
          if (outMin > inMin) {
            totalMinutes += (outMin - inMin);
          }
        }
      }


      row.working_hours = totalMinutes > 0 ? minutesToHHMM(totalMinutes) : 'Invalid';
      row.date = date.split('-').reverse().join('-');
      row.late_mins = late_mins.find(l => l.date === date)?.late_mins || 0;
      result.push(row);
    }
    total_late_mins = total_late_mins[0].total_late_mins || 0;
    const [absent_marked1, hrs] = await absent_marked(total_late_mins);

    return res.json({ absent_marked: absent_marked1, total_late_mins: total_late_mins, timing: result, data: staffInfo });
  } catch (error) {
    console.error('Error in /individual_data:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


module.exports = router;