const express = require('express');
const router = express.Router();
const db = require('../db');


async function start_end_time() {
  const today = new Date();
  const year = today.getFullYear();
  const start = today < new Date(`${year}-06-01`) ? `${year}-01-01` : `${year}-06-01`;
  return [start, today.toISOString().split('T')[0]];
}


function absent_marked(summary) {
  let leaves = 0;
  let num = Number(summary);
  if (num >= 360) {
    num -= 360;
    leaves += 0.5;
    while (num > 240) {
      num -= 240;
      leaves += 0.5;
    }
  }
  return [leaves, Number(summary)];
}


router.post('/attendance_viewer', async (req, res) => {
  const { date } = req.body;
  try {
    const [rows] = await db.query(
      `SELECT logs.staff_id, logs.time, staff.name 
       FROM staff JOIN logs ON staff.staff_id = logs.staff_id 
       WHERE date = ? ORDER BY time`, [date]
    );
    const categorized = {};
    for (const { staff_id, name, time } of rows) {
      if (!categorized[staff_id]) categorized[staff_id] = { name, times: [] };
      categorized[staff_id].times.push(time);
    }
    const result = Object.entries(categorized).map(([staff_id, { name, times }]) => ({
      staff_id,
      name,
      IN1: times[0] || null,
      OUT1: times[1] || null,
      IN2: times[2] || null,
      OUT2: times[3] || null,
      IN3: times[4] || null,
      OUT3: times[5] || null,
    }));
    res.json(result);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post('/dept_summary', async (req, res) => {
  const [startDate, endDate] = await start_end_time();
  const { category, dept } = req.body;
  let rows = [];
  let result = {};

  function addEntry(category, dept, entry) {
    if (!result[category]) result[category] = {};
    if (!result[category][dept]) result[category][dept] = [];
    result[category][dept].push(entry);
  }

  try {
    if (category === 'ALL') {
      // ALL: group by category and department
      [rows] = await db.query(`
        SELECT staff.staff_id, staff.name, staff.dept, 
               SUM(report.late_mins) AS summary, 
               category.category_description AS category
        FROM report
        JOIN staff ON staff.staff_id = report.staff_id
        JOIN category ON category.category_no = staff.category  
        WHERE report.date BETWEEN ? AND ?
        GROUP BY staff.dept, staff.staff_id, staff.name, category.category_description
        ORDER BY staff.dept, staff.staff_id
      `, [startDate, endDate]);

      for (const row of rows) {
        const { dept, summary, category, ...rest } = row;
        const [leaves, num1] = absent_marked(summary);
        addEntry(category, dept, { ...rest, summary: num1, leaves, dept });
      }
    } else if (
      (category === "Teaching Staff" || category === "Non Teaching Staff") &&
      dept && dept !== "ALL"
    ) {
      // Filter by both category and department
      [rows] = await db.query(`
        SELECT staff.staff_id, staff.name, staff.dept, 
               SUM(report.late_mins) AS summary
        FROM report
        JOIN staff ON staff.staff_id = report.staff_id
        JOIN category ON category.category_no = staff.category  
        WHERE report.date BETWEEN ? AND ? 
          AND category.category_description = ?
          AND staff.dept = ?
        GROUP BY staff.dept, staff.staff_id, staff.name
        ORDER BY staff.dept, staff.staff_id
      `, [startDate, endDate, category, dept]);

      for (const row of rows) {
        const { dept, summary, ...rest } = row;
        const [leaves, num1] = absent_marked(summary);
        if (!result[dept]) result[dept] = [];
        result[dept].push({ ...rest, summary: num1, leaves });
      }
    } else if (category === "Teaching Staff" || category === "Non Teaching Staff") {
      // Only filter by category
      [rows] = await db.query(`
        SELECT staff.staff_id, staff.name, staff.dept, 
               SUM(report.late_mins) AS summary
        FROM report
        JOIN staff ON staff.staff_id = report.staff_id
        JOIN category ON category.category_no = staff.category  
        WHERE report.date BETWEEN ? AND ? 
          AND category.category_description = ?
        GROUP BY staff.dept, staff.staff_id, staff.name
        ORDER BY staff.dept, staff.staff_id
      `, [startDate, endDate, category]);

      for (const row of rows) {
        const { dept, summary, ...rest } = row;
        const [leaves, num1] = absent_marked(summary);
        if (!result[dept]) result[dept] = [];
        result[dept].push({ ...rest, summary: num1, leaves });
      }
    } else if (dept && dept !== "ALL") {

      [rows] = await db.query(`
        SELECT staff.staff_id, staff.name, staff.dept, 
               SUM(report.late_mins) AS summary
        FROM report
        JOIN staff ON staff.staff_id = report.staff_id
        WHERE report.date BETWEEN ? AND ? AND staff.dept = ?
        GROUP BY staff.dept, staff.staff_id, staff.name
        ORDER BY staff.dept, staff.staff_id
      `, [startDate, endDate, dept]);

      for (const row of rows) {
        const { dept, summary, ...rest } = row;
        const [leaves, num1] = absent_marked(summary);
        if (!result[dept]) result[dept] = [];
        result[dept].push({ ...rest, summary: num1, leaves });
      }
    }

    const start_Date = startDate.split('-').reverse().join('-');
    const end_Date = endDate.split('-').reverse().join('-');
    res.json({ date: [start_Date, end_Date], data: result });
  } catch (err) {
    console.error("Error in /dept_summary:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.post('/individual_data', async (req, res) => {
  function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }
  function minutesToHHMM(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, '0')}hr${hrs !== 1 ? 's' : ''} ${mins.toString().padStart(2, '0')}mins`;
  }

  const { start_date, end_date, id } = req.body;
  const [start, end] = await start_end_time();
  try {
    const [rows] = await db.query(`
      SELECT logs.date, logs.time
      FROM logs 
      WHERE logs.date BETWEEN ? AND ? AND logs.staff_id = ?
      ORDER BY logs.date, logs.time
    `, [start_date, end_date, id]);

    const [staffInfo] = await db.query(`
      SELECT staff.name, staff.dept, staff.category
      FROM staff
      WHERE staff.staff_id = ?
    `, [id]);

    const [late_mins] = await db.query(`
      SELECT late_mins, date
      FROM report
      WHERE staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start_date, end_date]);

    let [total_late_mins] = await db.query(`
      SELECT SUM(late_mins) AS total_late_mins
      FROM report
      WHERE staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start, end]);

    // Get filtered late minutes (between start_date and end_date)
    let [filtered_late_mins] = await db.query(`
      SELECT SUM(late_mins) AS filtered_late_mins
      FROM report
      WHERE staff_id = ? AND date BETWEEN ? AND ?
    `, [id, start_date, end_date]);

    if (!staffInfo.length) return res.status(404).json({ error: 'Staff member not found.' });
    if (!rows.length) return res.status(404).json({ error: 'No attendance records found for the given date range.' });

    const groupedByDate = {};
    for (const row of rows) {
      if (!groupedByDate[row.date]) groupedByDate[row.date] = [];
      groupedByDate[row.date].push(row.time);
    }

    const result = [];
    for (const [date, times] of Object.entries(groupedByDate)) {
      times.sort();
      const row = { date: date.split('-').reverse().join('-') };
      let totalMinutes = 0;
      for (let i = 0; i < 3; i++) {
        const inTime = times[i * 2] || null;
        const outTime = times[i * 2 + 1] || null;
        row[`IN${i + 1}`] = inTime;
        row[`OUT${i + 1}`] = outTime || (inTime ? "Invalid" : null);
        if (inTime && outTime && outTime !== "Invalid") {
          const inMin = parseTimeToMinutes(inTime);
          const outMin = parseTimeToMinutes(outTime);
          if (outMin > inMin) totalMinutes += (outMin - inMin);
        }
      }
      row.working_hours = totalMinutes > 0 ? minutesToHHMM(totalMinutes) : 'Invalid';
      row.late_mins = late_mins.find(l => l.date === date)?.late_mins || 0;
      result.push(row);
    }

    total_late_mins = total_late_mins[0]?.total_late_mins || 0;
    filtered_late_mins = filtered_late_mins[0]?.filtered_late_mins || 0;
    const [absent_marked1] = absent_marked(total_late_mins);

    res.json({
      absent_marked: absent_marked1,
      total_late_mins: total_late_mins,
      filtered_late_mins: filtered_late_mins,
      timing: result,
      data: staffInfo
    });
  } catch (error) {
    console.error('Error in /individual_data:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});


router.post('/applyExemption', async (req, res) => {
  let { exemptionType, staffId, exemptionSession, exemptionDate, exemptionReason, otherReason, start_time, end_time, exemptionStatus } = req.body; let name = '';

  try {
    const [staffRows] = await db.query('SELECT name FROM staff WHERE staff_id = ?', [staffId]);
    if (staffRows.length === 0) {
      return res.status(400).json({ message: "Staff ID does not exist" });
    }
    name = staffRows[0].name;
  } catch (error) {
    return res.status(500).json({ message: "Failed to add exemption" });
  }

  if (exemptionSession.length === 0) {
    exemptionSession = null;
  }
  try {
    await db.query(
      `INSERT INTO exemptions 
            (exemptionType, staffId, exemptionStaffName, exemptionSession, exemptionDate, exemptionReason, otherReason, start_time, end_time,exemptionStatus) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exemptionType,
        staffId,
        name,
        Array.isArray(exemptionSession) ? exemptionSession.join(',') : exemptionSession,
        exemptionDate,
        exemptionReason,
        otherReason,
        start_time,
        end_time,
        exemptionStatus
      ]
    );
    res.json({ message: "Exemption added successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to add exemption" });
  }
});

router.get('/hr_exemptions_all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exemptions  ORDER BY exemptionDate DESC');
    res.json({ message: "Exemptions fetched successfully", exemptions: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch exemptions" });
  }
});
router.get("/staff_exemptions/:staffId", async (req, res) => {
  const { staffId } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM exemptions WHERE staffId = ? ORDER BY exemptionDate DESC', [staffId]);
    res.json({ message: "Exemptions fetched successfully", exemptions: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch exemptions" });
  }
});

router.post('/hr_exemptions/approve', async (req, res) => {
  const { exemptionId } = req.body;

  try {
    let sql = 'UPDATE exemptions SET exemptionStatus = "approved" WHERE exemptionId = ?';
    let params = [exemptionId];

    const [result] = await db.query(sql, params);
    if (result.affectedRows > 0) {
      res.json({ message: "Exemption approved successfully" });
    } else {
      res.json({ message: "No matching exemption found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to approve exemption" });
  }
});


router.post('/hr_exemptions/reject', async (req, res) => {
  const { exemptionId } = req.body;
  try {
    let sql = 'UPDATE exemptions SET exemptionStatus = "rejected" WHERE exemptionId = ?';
    let params = [exemptionId];
    const [result] = await db.query(sql, params);
    if (result.affectedRows > 0) {
      res.json({ message: "Exemption rejected successfully" });
    } else {
      res.json({ message: "No matching exemption found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to reject exemption" });
  }
});

router.post("/search/getuser", async (req, res) => {
  const { staffId } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM staff WHERE staff_id = ?', [staffId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }
    res.json({ message: "Staff fetched successfully", staff: rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});

module.exports = router;

