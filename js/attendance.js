document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const classId = params.get('classId');
  const classes = loadClasses();
  const cls = classes.find(c => c.id === classId);

  if (!cls) {
    document.getElementById('notFound').classList.remove('d-none');
    return;
  }

  document.getElementById('classTitle').textContent = cls.title;
  document.getElementById('attendanceContent').classList.remove('d-none');

  renderDateList(classId, todayIso());
});

function renderDateList(classId, today) {
  const allDates = getAttendanceDatesForClass(classId);
  const todayEntry = allDates.find(d => d.date === today) || { date: today, periods: [] };
  const pastEntries = allDates.filter(d => d.date !== today);
  const entries = [todayEntry, ...pastEntries];

  const listEl = document.getElementById('dateList');
  listEl.innerHTML = '';

  entries.forEach(({ date, periods }) => {
    const isToday = date === today;
    const label = isToday ? 'Today' : formatDisplayDateWithDay(parseIsoDate(date));
    const periodsText = periods.length > 0 ? `Periods taken: ${periods.join(', ')}` : 'No attendance yet';

    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="card h-100">
        <div class="card-body d-flex flex-column">
          <span class="fw-semibold">${label}</span>
          <span class="text-muted small mb-2">${periodsText}</span>
          <a href="take-attendance.html?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}"
             class="btn btn-primary btn-sm mt-auto align-self-start">Take Attendance</a>
        </div>
      </div>
    `;
    listEl.appendChild(col);
  });
}
