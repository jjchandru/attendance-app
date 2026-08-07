let currentClassId = null;
let currentDate = null;
let currentClass = null;
const selectedPeriods = new Set();

function currentLabel() {
  return Array.from(selectedPeriods).sort((a, b) => a - b).join(',');
}

function getRecordForLabel(label) {
  if (!label) return null;
  const records = loadAttendance();
  const key = attendanceRecordKey(currentClassId, currentDate, label);
  return records[key] || null;
}

function toggleAbsent(number) {
  const label = currentLabel();
  if (!label) return;

  const records = loadAttendance();
  const key = attendanceRecordKey(currentClassId, currentDate, label);
  const record = records[key] || { classId: currentClassId, date: currentDate, period: label, absentNumbers: [] };

  const absentSet = new Set(record.absentNumbers);
  if (absentSet.has(number)) {
    absentSet.delete(number);
  } else {
    absentSet.add(number);
  }
  record.absentNumbers = Array.from(absentSet);
  records[key] = record;
  saveAttendance(records);
}

function renderPeriodButtons() {
  const container = document.getElementById('periodButtons');
  container.innerHTML = '';

  for (let period = 1; period <= 7; period++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.period = String(period);
    btn.textContent = String(period);
    btn.className = `btn period-btn ${selectedPeriods.has(period) ? 'btn-primary' : 'btn-outline-primary'}`;
    container.appendChild(btn);
  }
}

function handlePeriodClick(event) {
  const btn = event.target.closest('.period-btn');
  if (!btn) return;

  const period = Number(btn.dataset.period);
  if (selectedPeriods.has(period)) {
    selectedPeriods.delete(period);
  } else {
    selectedPeriods.add(period);
  }

  renderPeriodButtons();
  renderStudentList(currentClass);
}

function renderStudentList(cls) {
  const label = currentLabel();
  const absentCountEl = document.getElementById('absentCount');
  const listEl = document.getElementById('studentList');

  if (!label) {
    absentCountEl.textContent = 'Select at least one period above to mark attendance.';
    listEl.innerHTML = '';
    return;
  }

  const record = getRecordForLabel(label);
  const absentSet = record ? new Set(record.absentNumbers) : new Set();
  const status = record ? 'already recorded' : 'not yet taken';
  absentCountEl.textContent = `Period ${label} — ${status} (${absentSet.size} absent / ${cls.students.length} students)`;

  listEl.classList.add('fading');
  listEl.innerHTML = '';
  cls.students.forEach(student => {
    const isAbsent = absentSet.has(student.number);
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex justify-content-between align-items-center';
    item.innerHTML = `
      <span class="d-flex flex-column">
        <span>${student.name}</span>
        <span class="text-muted small">${student.number}</span>
      </span>
      <button type="button"
        class="btn btn-sm ${isAbsent ? 'btn-danger' : 'btn-outline-danger'} absent-btn"
        data-number="${student.number}">
        ${isAbsent ? 'Absent' : 'Mark Absent'}
      </button>
    `;
    listEl.appendChild(item);
  });

  requestAnimationFrame(() => listEl.classList.remove('fading'));
}

function handleAbsentClick(event, cls) {
  const btn = event.target.closest('.absent-btn');
  if (!btn) return;

  toggleAbsent(btn.dataset.number);
  renderStudentList(cls);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  currentClassId = params.get('classId');
  currentDate = params.get('date') || todayIso();

  const classes = loadClasses();
  currentClass = classes.find(c => c.id === currentClassId);

  document.getElementById('backLink').href = `attendance.html?classId=${encodeURIComponent(currentClassId)}`;

  if (!currentClass) {
    document.getElementById('notFound').classList.remove('d-none');
    return;
  }

  document.getElementById('classTitle').textContent = currentClass.title;
  document.getElementById('dateLabel').textContent = formatDisplayDateWithDay(parseIsoDate(currentDate));
  document.getElementById('takeAttendanceContent').classList.remove('d-none');

  renderPeriodButtons();
  renderStudentList(currentClass);

  document.getElementById('periodButtons').addEventListener('click', handlePeriodClick);
  document.getElementById('studentList').addEventListener('click', (event) => handleAbsentClick(event, currentClass));
});
