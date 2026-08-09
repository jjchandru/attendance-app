const CLASSES_KEY = 'attendanceApp.classes';
const ATTENDANCE_KEY = 'attendanceApp.attendance';

function loadClasses() {
  const raw = localStorage.getItem(CLASSES_KEY);
  const classes = raw ? JSON.parse(raw) : [];
  
  // Ensure all students have batch field and compute hasLabBatches
  classes.forEach(cls => {
    cls.students.forEach(student => {
      if (!student.batch) {
        student.batch = 'none';
      }
    });
    cls.hasLabBatches = computeHasLabBatches(cls);
  });
  
  return classes;
}

function saveClasses(classes) {
  localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
}

function computeHasLabBatches(cls) {
  return cls.students.some(s => s.batch === '1' || s.batch === '2');
}

function attendanceRecordKey(classId, date, period) {
  return `${classId}::${date}::${period}`;
}

function loadAttendance() {
  const raw = localStorage.getItem(ATTENDANCE_KEY);
  const records = raw ? JSON.parse(raw) : {};
  
  // Ensure all records have batch field
  Object.values(records).forEach(record => {
    if (!record.batch) {
      record.batch = 'all';
    }
  });
  
  return records;
}

function saveAttendance(records) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
}

function getAttendanceDatesForClass(classId) {
  const records = loadAttendance();
  const periodsByDate = {};

  Object.values(records).forEach(record => {
    if (record.classId !== classId) return;
    if (!periodsByDate[record.date]) periodsByDate[record.date] = [];
    periodsByDate[record.date].push(record.period);
  });

  return Object.keys(periodsByDate)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({ date, periods: periodsByDate[date] }));
}

function todayIso() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDisplayDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTH_ABBREVIATIONS[date.getMonth()]}`;
}

function formatDisplayDateWithDay(date) {
  return `${formatDisplayDate(date)}, ${WEEKDAY_NAMES[date.getDay()]}`;
}

function parseIsoDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseRosterCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row plus at least one student row.');
  }

  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim());
    if (parts.length < 2) continue;

    const email = parts[parts.length - 1];
    const name = parts.slice(0, parts.length - 1).join(', ');
    const match = email.match(/(\d+)@/);
    if (!match) continue;

    students.push({ number: match[1], name, batch: 'none' });
  }

  if (students.length === 0) {
    throw new Error('No valid student rows found. Expecting Name and Email columns.');
  }

  return students;
}
