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
      </div>
    `;
    listEl.appendChild(item);
  });
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
});
