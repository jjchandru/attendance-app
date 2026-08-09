let currentClassId = null;
let currentDate = null;
let currentClass = null;
const selectedPeriods = new Set();
let selectedBatch = 'all'; // 'all', '1', or '2'

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
  const record = records[key] || { 
    classId: currentClassId, 
    date: currentDate, 
    period: label, 
    batch: selectedBatch,
    absentNumbers: [] 
  };

  const absentSet = new Set(record.absentNumbers);
  if (absentSet.has(number)) {
    absentSet.delete(number);
  } else {
    absentSet.add(number);
  }
  record.absentNumbers = Array.from(absentSet);
  record.batch = selectedBatch; // Update batch when modifying
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
  
  // Auto-select batch filter based on existing record
  const label = currentLabel();
  if (label) {
    const record = getRecordForLabel(label);
    if (record && record.batch && record.batch !== 'all') {
      selectedBatch = record.batch;
    } else {
      selectedBatch = 'all';
    }
    // Update batch buttons if they're visible
    if (currentClass.hasLabBatches) {
      renderBatchButtons();
    }
  }
  
  highlightMatchingRecord();
  renderStudentList(currentClass);
}

function renderBatchButtons() {
  const container = document.getElementById('batchButtons');
  container.innerHTML = '';

  const batches = [
    { value: 'all', label: 'All' },
    { value: '1', label: 'Batch 1' },
    { value: '2', label: 'Batch 2' }
  ];

  batches.forEach(batch => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.batch = batch.value;
    btn.textContent = batch.label;
    btn.className = `btn btn-sm batch-filter-btn ${selectedBatch === batch.value ? 'btn-primary' : 'btn-outline-primary'}`;
    container.appendChild(btn);
  });
}

function handleBatchClick(event) {
  const btn = event.target.closest('.batch-filter-btn');
  if (!btn) return;

  selectedBatch = btn.dataset.batch;
  renderBatchButtons();
  renderStudentList(currentClass);
}

function renderExistingRecords() {
  const records = loadAttendance();
  const dateRecords = [];
  
  for (const key in records) {
    const record = records[key];
    if (record.classId === currentClassId && record.date === currentDate) {
      dateRecords.push(record);
    }
  }
  
  const section = document.getElementById('existingRecordsSection');
  const listEl = document.getElementById('existingRecordsList');
  
  if (dateRecords.length === 0) {
    section.classList.add('d-none');
    return;
  }
  
  section.classList.remove('d-none');
  listEl.innerHTML = '';
  
  // Sort by period label
  dateRecords.sort((a, b) => {
    const aFirst = parseInt(a.period.split(',')[0]);
    const bFirst = parseInt(b.period.split(',')[0]);
    return aFirst - bFirst;
  });
  
  dateRecords.forEach(record => {
    const badge = document.createElement('div');
    badge.className = 'existing-record-badge';
    badge.dataset.period = record.period;
    
    // Display batch info if not 'all'
    const batchText = record.batch && record.batch !== 'all' ? ` - Batch ${record.batch}` : '';
    
    badge.innerHTML = `
      <span class="badge bg-success me-2">✓ Period ${record.period}${batchText}</span>
      <span class="text-muted">${record.absentNumbers.length} absent</span>
    `;
    listEl.appendChild(badge);
  });
}

function highlightMatchingRecord() {
  const label = currentLabel();
  
  document.querySelectorAll('.existing-record-badge').forEach(badge => {
    if (badge.dataset.period === label) {
      badge.classList.add('highlighted');
    } else {
      badge.classList.remove('highlighted');
    }
  });
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

  // Filter students by batch
  let filteredStudents = cls.students;
  if (selectedBatch === '1') {
    filteredStudents = cls.students.filter(s => s.batch === '1');
  } else if (selectedBatch === '2') {
    filteredStudents = cls.students.filter(s => s.batch === '2');
  }
  // 'all' shows all students

  const record = getRecordForLabel(label);
  const absentSet = record ? new Set(record.absentNumbers) : new Set();
  const status = record ? 'already recorded' : 'not yet taken';
  
  // Display batch context in count
  const batchContext = selectedBatch === 'all' ? 'All' : `Batch ${selectedBatch}`;
  absentCountEl.textContent = `Period ${label} — ${batchContext} — ${status} (${absentSet.size} absent / ${filteredStudents.length} students)`;

  listEl.classList.add('fading');
  listEl.innerHTML = '';
  filteredStudents.forEach(student => {
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

  // Show batch selection if class has lab batches
  if (currentClass.hasLabBatches) {
    document.getElementById('batchSelectionSection').classList.remove('d-none');
    renderBatchButtons();
    document.getElementById('batchButtons').addEventListener('click', handleBatchClick);
  }

  renderPeriodButtons();
  renderExistingRecords();
  renderStudentList(currentClass);

  document.getElementById('periodButtons').addEventListener('click', handlePeriodClick);
  document.getElementById('studentList').addEventListener('click', (event) => handleAbsentClick(event, currentClass));
});
