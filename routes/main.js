const express = require('express');
const router = express.Router();
const db = require('../db');

let category_data = [];


  function get_time(t1,date) {
    const ms1 = new Date(`${date} ${t1}`).getTime();
    return ms1;
  }


async function getCategoryData() {
  const [rows] = await db.query("SELECT * FROM category");
  category_data = rows;

    return ;
}

async function lateMinutes(values,category,date){
  let sum = 0;
  let max = 0;
  let numbers = [];
  let arr = [];
  let start_const = 0;
  let end_const = 0;
  let start = new Date(values[0]).getTime();
  let end = new Date(values[values.length -1]).getTime();
  let Minutes = 0;
  let Min = 70;

  const Time = "10:00:00";
  const inBreakTime = get_time(Time,date);
  const category1_data = category_data.filter((cat) => cat.category_no === category);

  for (let i = 1; i < values.length - 1; i=i+2) {
    
    const outTime = new Date(values[i]).getTime();
    const inTime = new Date(values[i + 1]).getTime();

    const diff = (inTime - outTime) / 60000;
    arr.push(diff);
   
    
   
  }

  if (category1_data[0].in_time <= 1) {
    start_const = start;
    const temp = new Date(`${values[values.length -1].slice(0,10)} ${category1_data[0].out_time}`);
    const hours = temp.getHours();
    const minutes = temp.getMinutes();
    end_const = (hours * 60 * 60 * 1000 + minutes * 60 * 1000)+start;
    sum = arr.reduce((acc, num) => acc + num, 0);
    console.log("sum",sum);
    Minutes += Math.ceil(sum);
    
  }

  else{
      
  
  max = Math.max(...arr);
  Min -= max;
  numbers = arr.filter((num) => num !== max);
  sum = numbers.reduce((acc, num) => acc + num, 0);
  Minutes += Math.ceil(sum);
  
  if (Min < 0) {
    Minutes += Math.abs(Min);
    
  }
}
  
  start_const = get_time(category1_data[0].in_time,values[0].slice(0,10));
 
  end_const = get_time(category1_data[0].out_time,values[values.length -1].slice(0,10));

  
  if(start> start_const){
    Minutes += Math.ceil((start - start_const) / 60000);
    Minutes+=15; 
  }
  if(end){
    if(end < end_const) {
      Minutes += Math.ceil((end_const - end) / 60000);
      
    }
  }
  

  return Minutes;

}

async function diffMinutes(t1, t2) {
  const ms1 = new Date(t1).getTime();
  const ms2 = new Date(t2).getTime();
  return (ms1 - ms2) / 1000 / 60;
}

async function insertLog(staffId, date, logTimes,staffCategory) {
  let columns = [];
  let values = [];
  let my_array = [];
  let late_mins = 0;
  let attendance = "A";
  if (logTimes.length > 0){

  values.push(logTimes[0]);
 
  for (let i = 1; i < logTimes.length; i++) {
   
    if (await diffMinutes(logTimes[i], logTimes[i - 1]) > 10) {
      values.push(logTimes[i]);
    }
  }

  for (let i = 0; i < values.length; i++) {
    
    const label = i % 2 === 0 ? "IN" : "OUT";
    const num = Math.ceil((i + 1) / 2);
    columns.push(`${label}${num}`);
  }
  
  late_mins = await lateMinutes(values,staffCategory,date);
  attendance = "P" ;
  
}
  const query = `INSERT INTO report (staff_id, date, ${columns.join(", ")},late_mins,attendance)
                 VALUES (?, ?, ${columns.map(() => "?").join(", ")},?,?)`;

  try {
    await db.query(query, [staffId, date, ...values,late_mins,attendance]);
    console.log(`Log inserted for Staff ID: ${staffId}`);
  } catch (err) {
    console.error("Error inserting log:", err);
  }
}

async function processAndInsertLogs() {
  try {
    await getCategoryData();
    const processedStaff = new Set();
    
    const [logResults] = await db.query(
     "SELECT logs.staff_id,staff.name,logs.time,staff.category FROM staff JOIN logs ON logs.staff_id = staff.staff_id  " 
    );//WHERE time >= NOW() - INTERVAL 1 DAY and time <= NOW()
  console.log("Log Results:", logResults);
    for (const { staff_id: staffId,name: staffName, time: logTime, category: StaffCategory } of logResults) {
      const logsForStaff = logResults.map(log => log.time);
      
      if (processedStaff.has(staffId)) continue;

      processedStaff.add(staffId);

      const [year,month,day] = logTime.split(' ')[0].split('-'); 
      const date = `${year}-${month}-${day}`; 
      await insertLog(staffId, date, logsForStaff,StaffCategory);
      
      
    }
  } catch (err) {
    console.error("Error processing logs:", err);
  }
}

router.get("/pl", async (req, res) => {
  try {
    await processAndInsertLogs();
    res.status(200).json({ message: "Logs processed and inserted!" });
  } catch (error) {
    console.error("Error processing logs:", error);
    res.status(500).json({ error: "Error processing logs" });
  }
});

// Optional CRON job example
// const cron = require("node-cron");
// cron.schedule('0 18 * * *', () => {
//   processAndInsertLogs().catch(console.error);
// });

module.exports = router;