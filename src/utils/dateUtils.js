// Returns today's date as YYYY-MM-DD in IST (Asia/Kolkata)
export function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Returns yesterday's date as YYYY-MM-DD in IST
export function yesterdayIST() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
