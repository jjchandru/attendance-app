let currentClassId = null;
let selectedYear = null;
let selectedMonth = null;
let selectedDay = null;
let selectedDateStr = null;
let existingDates = new Set();

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  currentClassId = params.get('classId');
  const classes = loadClasses();
  const cls = classes.find(c => c.id === currentClassId);

  if (!cls) {
    document.getElementById('notFound').classList.remove('d-none');
    return;
  }

  document.getElementById('classTitle').textContent = cls.title;
  document.getElementById('attendanceContent').classList.remove('d-none');

  // Load existing attendance dates
  const attendanceDates = getAttendanceDatesForClass(currentClassId);
  existingDates = new Set(attendanceDates.map(d => d.date));

  initializeYearButtons();
  initializeMonthButtons();
  
  // Select current month by default and render calendar
  const currentMonth = new Date().getMonth();
  handleMonthSelect(currentMonth);
  
  document.getElementById('takeAttendanceBtn').addEventListener('click', handleTakeAttendance);
});

function initializeYearButtons() {
  const container = document.getElementById('yearButtons');
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  years.forEach(year => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline-primary';
    btn.textContent = year;
    btn.dataset.year = year;
    
    if (year === currentYear) {
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary');
      selectedYear = year;
    }
    
    btn.addEventListener('click', () => handleYearSelect(year));
    container.appendChild(btn);
  });
}

function initializeMonthButtons() {
  const container = document.getElementById('monthButtons');

  MONTH_NAMES.forEach((name, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline-primary';
    btn.textContent = name;
    btn.dataset.month = index;
    btn.addEventListener('click', () => handleMonthSelect(index));
    container.appendChild(btn);
  });
}

function handleYearSelect(year) {
  selectedYear = year;
  
  // Update year buttons
  document.querySelectorAll('#yearButtons button').forEach(btn => {
    if (parseInt(btn.dataset.year) === year) {
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-primary');
    }
  });

  // Reset month and day if needed
  if (selectedMonth !== null) {
    renderCalendar();
  }
}

function handleMonthSelect(month) {
  selectedMonth = month;
  selectedDay = null;
  selectedDateStr = null;
  
  // Update month buttons
  document.querySelectorAll('#monthButtons button').forEach(btn => {
    if (parseInt(btn.dataset.month) === month) {
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-primary');
    }
  });

  renderCalendar();
  
  // Hide period details and action button
  document.getElementById('periodDetailsSection').classList.add('d-none');
  document.getElementById('actionSection').classList.add('d-none');
}

function renderCalendar() {
  const calendarSection = document.getElementById('calendarSection');
  const calendarDates = document.getElementById('calendarDates');
  
  calendarSection.classList.remove('d-none');
  calendarDates.innerHTML = '';

  if (selectedYear === null || selectedMonth === null) return;

  const firstDay = new Date(selectedYear, selectedMonth, 1);
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Get first day of week (0 = Sunday, 1 = Monday, etc.)
  // Adjust so Monday = 0
  let firstDayOfWeek = firstDay.getDay() - 1;
  if (firstDayOfWeek === -1) firstDayOfWeek = 6; // Sunday becomes 6

  const today = new Date();
  const todayStr = todayIso();

  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfWeek; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-date-cell empty';
    calendarDates.appendChild(empty);
  }

  // Add date buttons
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(selectedYear, selectedMonth, day);
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isFuture = dateObj > today;
    const isToday = dateStr === todayStr;
    const hasAttendance = existingDates.has(dateStr);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-date-cell';
    btn.textContent = day;
    btn.dataset.date = dateStr;

    if (isFuture) {
      btn.disabled = true;
      btn.classList.add('disabled');
    } else {
      btn.addEventListener('click', () => handleDaySelect(day, dateStr));
    }

    if (isToday) {
      btn.classList.add('today');
    }

    if (hasAttendance) {
      btn.classList.add('has-attendance');
      const badge = document.createElement('span');
      badge.className = 'attendance-badge';
      badge.textContent = '•';
      btn.appendChild(badge);
    }

    calendarDates.appendChild(btn);
  }
}

function handleDaySelect(day, dateStr) {
  selectedDay = day;
  selectedDateStr = dateStr;

  // Update calendar buttons
  document.querySelectorAll('.calendar-date-cell').forEach(btn => {
    if (btn.dataset.date === dateStr) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });

  // Show and populate period details
  showPeriodDetails(dateStr);
  
  // Show action button
  document.getElementById('actionSection').classList.remove('d-none');
  
  // Scroll to bottom to show details
  setTimeout(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  }, 100);
}

function showPeriodDetails(dateStr) {
  const dateObj = parseIsoDate(dateStr);
  const dateText = formatDisplayDateWithDay(dateObj);
  
  document.getElementById('selectedDateText').textContent = dateText;
  
  // Get all attendance records for this date
  const records = loadAttendance();
  const dateRecords = [];
  
  for (const key in records) {
    const record = records[key];
    if (record.classId === currentClassId && record.date === dateStr) {
      dateRecords.push(record);
    }
  }
  
  const detailsList = document.getElementById('periodDetailsList');
  detailsList.innerHTML = '';
  
  if (dateRecords.length === 0) {
    detailsList.innerHTML = '<p class="text-muted mb-0">No attendance recorded yet</p>';
  } else {
    // Sort by period label
    dateRecords.sort((a, b) => {
      const aFirst = parseInt(a.period.split(',')[0]);
      const bFirst = parseInt(b.period.split(',')[0]);
      return aFirst - bFirst;
    });
    
    dateRecords.forEach(record => {
      const badge = document.createElement('div');
      badge.className = 'period-detail-badge';
      
      // Display batch info if not 'all'
      const batchText = record.batch && record.batch !== 'all' ? ` - Batch ${record.batch}` : '';
      
      badge.innerHTML = `
        <span class="badge bg-success me-2">Period ${record.period}${batchText}</span>
        <span class="text-muted">${record.absentNumbers.length} absent</span>
      `;
      detailsList.appendChild(badge);
    });
  }
  
  // Show section with animation
  const section = document.getElementById('periodDetailsSection');
  section.classList.remove('d-none');
  section.classList.add('period-details-enter');
  
  // Remove animation class after animation completes
  setTimeout(() => {
    section.classList.remove('period-details-enter');
  }, 300);
}

function handleTakeAttendance() {
  if (selectedYear === null || selectedMonth === null || selectedDay === null) {
    alert('Please select a date first');
    return;
  }

  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  window.location.href = `take-attendance.html?classId=${encodeURIComponent(currentClassId)}&date=${encodeURIComponent(dateStr)}`;
}
