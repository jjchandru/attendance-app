function renderClasses() {
  const classes = loadClasses();
  const listEl = document.getElementById('classList');
  const emptyEl = document.getElementById('emptyState');

  listEl.innerHTML = '';

  if (classes.length === 0) {
    emptyEl.classList.remove('d-none');
    return;
  }
  emptyEl.classList.add('d-none');

  classes.forEach(cls => {
    const item = document.createElement('div');
    item.className = 'list-group-item class-list-item';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <span>${cls.title}</span>
        <span class="text-muted student-count">${cls.students.length} students</span>
      </div>
      <div class="d-flex align-items-center justify-content-end gap-2 mt-2">
        <a href="attendance.html?classId=${encodeURIComponent(cls.id)}" class="btn btn-sm btn-outline-primary">Attendance</a>
        <a href="manage.html?classId=${encodeURIComponent(cls.id)}" class="btn btn-sm btn-outline-secondary">Manage</a>
        <button type="button" class="btn btn-sm btn-outline-success download-class-btn" data-class-id="${cls.id}">
          <i class="bi bi-download me-1"></i>Download
        </button>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function handleDownloadClassClick(event) {
  const btn = event.target.closest('.download-class-btn');
  if (!btn) return;

  const classes = loadClasses();
  const cls = classes.find(c => c.id === btn.dataset.classId);
  if (!cls) return;

  downloadClassAttendanceCsv(cls);
}

function downloadClassAttendanceCsv(cls) {
  const records = loadAttendance();
  const classRecords = Object.values(records).filter(r => r.classId === cls.id);

  if (classRecords.length === 0) {
    alert('No attendance records found for this class.');
    return;
  }

  // Expand (date, period) into per-batch columns and sort by date, period, batch
  const columns = []; // Each: { date, period, batch, label, record }

  classRecords.forEach(record => {
    const periods = record.period.split(',').map(p => parseInt(p.trim()));
    const batchLabel = record.batch === 'all' ? 'All' : `B${record.batch}`;

    periods.forEach(period => {
      const exists = columns.some(col => col.date === record.date && col.period === period && col.batch === record.batch);
      if (!exists) {
        columns.push({
          date: record.date,
          period: period,
          batch: record.batch,
          label: batchLabel,
          record: record
        });
      }
    });
  });

  columns.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.period !== b.period) return a.period - b.period;
    if (a.batch === 'all') return -1;
    if (b.batch === 'all') return 1;
    return a.batch.localeCompare(b.batch);
  });

  // Build CSV header
  const headers = ['RRR No.', 'Name'];
  columns.forEach(col => {
    const colDate = parseIsoDate(col.date);
    const colDd = String(colDate.getDate()).padStart(2, '0');
    const colMm = String(colDate.getMonth() + 1).padStart(2, '0');
    headers.push(`${colDd}/${colMm} P${col.period}-${col.label}`);
  });

  // Build CSV rows
  const rows = [headers];

  cls.students.forEach(student => {
    const row = [`="${student.number}"`, student.name];

    columns.forEach(col => {
      const studentBatch = student.batch || 'none';

      if (col.batch === 'all' || col.batch === studentBatch) {
        const absentSet = new Set(col.record.absentNumbers);
        if (absentSet.has(student.number)) {
          row.push('a');
        } else {
          row.push('/');
        }
      } else {
        row.push('');
      }
    });

    rows.push(row);
  });

  // Convert to CSV string
  const csvContent = rows.map(row =>
    row.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');

  // Generate filename: {class-name-with-hyphens}-{dd}-{mm}.csv (date of generation)
  const now = new Date();
  const genDd = String(now.getDate()).padStart(2, '0');
  const genMm = String(now.getMonth() + 1).padStart(2, '0');
  const className = cls.title.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `${className}-${genDd}-${genMm}.csv`;

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleUploadSubmit(event) {
  event.preventDefault();

  const titleInput = document.getElementById('classTitleInput');
  const fileInput = document.getElementById('classCsvInput');
  const errorEl = document.getElementById('uploadError');
  errorEl.classList.add('d-none');

  const title = titleInput.value.trim();
  const file = fileInput.files[0];
  if (!title || !file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const students = parseRosterCsv(reader.result);
      const classes = loadClasses();
      classes.push({
        id: Date.now().toString(),
        title,
        students,
        createdAt: new Date().toISOString()
      });
      saveClasses(classes);
      renderClasses();

      event.target.reset();
      const modalEl = document.getElementById('uploadClassModal');
      bootstrap.Modal.getInstance(modalEl).hide();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('d-none');
    }
  };
  reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', () => {
  renderClasses();
  document.getElementById('uploadClassForm').addEventListener('submit', handleUploadSubmit);
  document.getElementById('classList').addEventListener('click', handleDownloadClassClick);
});
