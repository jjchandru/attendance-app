let currentClassId = null;
let editingStudentNumber = null;

function getClassIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('classId');
}

function renderStudentList(cls) {
  document.getElementById('classTitle').textContent = cls.title;
  document.getElementById('studentCount').textContent = `${cls.students.length} students`;

  const listEl = document.getElementById('studentList');
  listEl.innerHTML = '';

  cls.students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'list-group-item';
    
    // Batch button classes
    const noneClass = student.batch === 'none' ? 'btn-primary' : 'btn-outline-primary';
    const batch1Class = student.batch === '1' ? 'btn-primary' : 'btn-outline-primary';
    const batch2Class = student.batch === '2' ? 'btn-primary' : 'btn-outline-primary';
    
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="d-flex flex-column">
          <span>${student.name}</span>
          <span class="text-muted small mb-2">${student.number}</span>
          <div class="d-flex gap-1">
            <button type="button" class="btn btn-sm ${noneClass} batch-btn" 
                    data-number="${student.number}" data-batch="none">None</button>
            <button type="button" class="btn btn-sm ${batch1Class} batch-btn" 
                    data-number="${student.number}" data-batch="1">Batch 1</button>
            <button type="button" class="btn btn-sm ${batch2Class} batch-btn" 
                    data-number="${student.number}" data-batch="2">Batch 2</button>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button type="button" class="btn btn-sm btn-outline-secondary edit-student-btn" data-number="${student.number}">Edit</button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-student-btn" data-number="${student.number}">Delete</button>
        </div>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function handleEditStudentClick(event) {
  const btn = event.target.closest('.edit-student-btn');
  if (!btn) return;

  const number = btn.dataset.number;
  const classes = loadClasses();
  const cls = classes.find(c => c.id === currentClassId);
  if (!cls) return;

  const student = cls.students.find(s => s.number === number);
  if (!student) return;

  editingStudentNumber = number;
  document.getElementById('editStudentError').classList.add('d-none');
  document.getElementById('editStudentNameInput').value = student.name;
  document.getElementById('editStudentNumberInput').value = student.number;

  const modalEl = document.getElementById('editStudentModal');
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function handleEditStudentSubmit(event) {
  event.preventDefault();

  const nameInput = document.getElementById('editStudentNameInput');
  const numberInput = document.getElementById('editStudentNumberInput');
  const errorEl = document.getElementById('editStudentError');
  errorEl.classList.add('d-none');

  const name = nameInput.value.trim();
  const number = numberInput.value.trim();
  if (!name || !number) return;

  const classes = loadClasses();
  const cls = classes.find(c => c.id === currentClassId);
  if (!cls) return;

  if (cls.students.some(s => s.number === number && s.number !== editingStudentNumber)) {
    errorEl.textContent = `A student with number "${number}" already exists in this class.`;
    errorEl.classList.remove('d-none');
    return;
  }

  const student = cls.students.find(s => s.number === editingStudentNumber);
  if (!student) return;

  student.name = name;
  student.number = number;
  saveClasses(classes);
  renderStudentList(cls);

  const modalEl = document.getElementById('editStudentModal');
  bootstrap.Modal.getInstance(modalEl).hide();
}

function handleDeleteStudentClick(event) {
  const btn = event.target.closest('.delete-student-btn');
  if (!btn) return;

  const number = btn.dataset.number;
  const classes = loadClasses();
  const cls = classes.find(c => c.id === currentClassId);
  if (!cls) return;

  const student = cls.students.find(s => s.number === number);
  if (!student) return;

  if (!window.confirm(`Remove ${student.name} (${student.number}) from this class?`)) return;

  cls.students = cls.students.filter(s => s.number !== number);
  saveClasses(classes);
  renderStudentList(cls);
}

function handleBatchClick(event) {
  const btn = event.target.closest('.batch-btn');
  if (!btn) return;

  const number = btn.dataset.number;
  const batch = btn.dataset.batch;

  const classes = loadClasses();
  const cls = classes.find(c => c.id === currentClassId);
  if (!cls) return;

  const student = cls.students.find(s => s.number === number);
  if (!student) return;

  // Update student batch
  student.batch = batch;
  
  // Recalculate hasLabBatches
  cls.hasLabBatches = computeHasLabBatches(cls);
  
  // Save immediately
  saveClasses(classes);
  
  // Re-render to update button states
  renderStudentList(cls);
}

function handleAddStudentSubmit(event) {
  event.preventDefault();

  const nameInput = document.getElementById('studentNameInput');
  const numberInput = document.getElementById('studentNumberInput');
  const errorEl = document.getElementById('addStudentError');
  errorEl.classList.add('d-none');

  const name = nameInput.value.trim();
  const number = numberInput.value.trim();
  if (!name || !number) return;

  const classes = loadClasses();
  const cls = classes.find(c => c.id === currentClassId);
  if (!cls) return;

  if (cls.students.some(s => s.number === number)) {
    errorEl.textContent = `A student with number "${number}" already exists in this class.`;
    errorEl.classList.remove('d-none');
    return;
  }

  cls.students.push({ number, name, batch: 'none' });
  cls.hasLabBatches = computeHasLabBatches(cls);
  saveClasses(classes);
  renderStudentList(cls);

  event.target.reset();
  const modalEl = document.getElementById('addStudentModal');
  bootstrap.Modal.getInstance(modalEl).hide();
}

document.addEventListener('DOMContentLoaded', () => {
  currentClassId = getClassIdFromUrl();
  const classes = loadClasses();
  const cls = classes.find(c => c.id === currentClassId);

  if (!cls) {
    document.getElementById('notFound').classList.remove('d-none');
    return;
  }

  document.getElementById('manageContent').classList.remove('d-none');
  renderStudentList(cls);

  document.getElementById('addStudentForm').addEventListener('submit', handleAddStudentSubmit);
  document.getElementById('editStudentForm').addEventListener('submit', handleEditStudentSubmit);
  document.getElementById('studentList').addEventListener('click', handleEditStudentClick);
  document.getElementById('studentList').addEventListener('click', handleDeleteStudentClick);
  document.getElementById('studentList').addEventListener('click', handleBatchClick);
});
