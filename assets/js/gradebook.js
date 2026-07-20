(function () {
  const PASSING_GRADE = 6;
  const state = {
    session: null,
    students: [],
    turmas: [],
    disciplinas: [],
    professores: [],
    grades: [],
    currentStudents: []
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `grade-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isManager() {
    return ["administrador", "funcionarios", "professores"].includes(state.session?.role);
  }

  function isTeacher() {
    return state.session?.role === "professores";
  }

  function setFeedback(id, message, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message || "";
    element.className = `feedback${type ? ` ${type}` : ""}`;
  }

  function parseList(value) {
    return String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function currentProfessor() {
    return state.professores.find(function (professor) {
      return (state.session.userId && String(professor.auth_user_id || "") === String(state.session.userId))
        || normalize(professor.email) === normalize(state.session.email)
        || normalize(professor.nome) === normalize(state.session.name);
    }) || null;
  }

  function availableSubjects() {
    const names = new Set();
    if (isTeacher()) {
      parseList(currentProfessor()?.disciplinas).forEach(function (name) { names.add(name); });
    } else {
      state.disciplinas.forEach(function (item) { if (item.nome) names.add(item.nome); });
      state.professores.forEach(function (professor) { parseList(professor.disciplinas).forEach(function (name) { names.add(name); }); });
    }
    return [...names].sort(function (left, right) { return left.localeCompare(right, "pt-BR"); });
  }

  function availableYears() {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear - 1, currentYear, currentYear + 1]);
    state.grades.forEach(function (grade) { if (grade.academicYear) years.add(Number(grade.academicYear)); });
    return [...years].sort(function (left, right) { return right - left; });
  }

  function yearOptions(selectedYear) {
    return availableYears().map(function (year) { return `<option value="${year}" ${Number(selectedYear) === year ? "selected" : ""}>${year}</option>`; }).join("");
  }

  function populateControls() {
    const currentYear = new Date().getFullYear();
    document.getElementById("grades-year").innerHTML = yearOptions(currentYear);
    document.getElementById("report-year").innerHTML = yearOptions(currentYear);

    const turmaNames = [...new Set(state.turmas.map(function (turma) { return turma.nome; }).filter(Boolean))].sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    document.getElementById("grades-turma").innerHTML = turmaNames.length
      ? turmaNames.map(function (name) { return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; }).join("")
      : `<option value="">Nenhuma turma disponível</option>`;

    const subjects = availableSubjects();
    document.getElementById("grades-subject").innerHTML = subjects.length
      ? subjects.map(function (name) { return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; }).join("")
      : `<option value="">Nenhuma disciplina disponível</option>`;

    const reportStudents = [...state.students].sort(function (a, b) { return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"); });
    document.getElementById("report-student").innerHTML = reportStudents.length
      ? reportStudents.map(function (student) { return `<option value="${escapeHtml(student.id)}">${escapeHtml(student.nome)}${student.turma ? ` · ${escapeHtml(student.turma)}` : ""}</option>`; }).join("")
      : `<option value="">Nenhum aluno disponível</option>`;
  }

  function contextValues() {
    return {
      academicYear: Number(document.getElementById("grades-year").value),
      period: Number(document.getElementById("grades-period").value),
      turma: document.getElementById("grades-turma").value,
      subject: document.getElementById("grades-subject").value
    };
  }

  function matchingGrade(studentId, context) {
    return state.grades.find(function (grade) {
      return Number(grade.academicYear) === context.academicYear
        && Number(grade.period) === context.period
        && String(grade.studentId) === String(studentId)
        && normalize(grade.subject) === normalize(context.subject);
    }) || null;
  }

  function formatInputNumber(value) {
    if (value === null || value === undefined || value === "") return "";
    return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function renderRegister() {
    const context = contextValues();
    state.currentStudents = state.students.filter(function (student) { return normalize(student.turma) === normalize(context.turma); }).sort(function (a, b) {
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });

    const register = document.getElementById("grades-register");
    const empty = document.getElementById("grades-entry-empty");
    const hasStudents = state.currentStudents.length > 0;
    register.hidden = !hasStudents;
    empty.hidden = hasStudents;
    if (!hasStudents) return;

    const contextGrades = state.currentStudents.map(function (student) { return matchingGrade(student.id, context); }).filter(Boolean);
    const allPublished = contextGrades.length > 0 && contextGrades.every(function (grade) { return grade.status === "published"; });
    document.getElementById("grades-register-title").textContent = `${context.subject} · ${context.turma}`;
    document.getElementById("grades-register-summary").textContent = `${context.period}º bimestre de ${context.academicYear} · ${state.currentStudents.length} aluno(s)`;
    document.getElementById("grades-register-status").textContent = allPublished ? "Notas publicadas" : "Rascunho";
    document.getElementById("grades-register-status").className = `status-badge${allPublished ? " success" : ""}`;

    document.getElementById("grades-student-list").innerHTML = state.currentStudents.map(function (student) {
      const grade = matchingGrade(student.id, context);
      return `
        <article class="grades-student-row" data-grade-student="${escapeHtml(student.id)}">
          <span class="grades-student-identity"><b>${escapeHtml(String(student.nome || "A").trim().slice(0, 1).toUpperCase())}</b><span><strong>${escapeHtml(student.nome)}</strong><small>${escapeHtml(student.matricula || "Sem matrícula")}</small></span></span>
          <label data-label="Nota"><span>Nota</span><input data-grade-field="grade" inputmode="decimal" value="${escapeHtml(formatInputNumber(grade?.grade))}" placeholder="0 a 10"></label>
          <label data-label="Recuperação"><span>Recuperação</span><input data-grade-field="recovery" inputmode="decimal" value="${escapeHtml(formatInputNumber(grade?.recoveryGrade))}" placeholder="Opcional"></label>
          <label data-label="Faltas"><span>Faltas</span><input data-grade-field="absences" type="number" min="0" max="999" value="${escapeHtml(grade?.absences ?? 0)}"></label>
          <label class="grades-note-field" data-label="Observação"><span>Observação</span><input data-grade-field="note" maxlength="300" value="${escapeHtml(grade?.note || "")}" placeholder="Opcional"></label>
        </article>`;
    }).join("");
    setFeedback("grades-feedback", "");
  }

  function parseGradeValue(value) {
    const normalized = String(value || "").trim().replace(",", ".");
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : NaN;
  }

  function readStudentRow(row) {
    const grade = parseGradeValue(row.querySelector('[data-grade-field="grade"]').value);
    const recoveryGrade = parseGradeValue(row.querySelector('[data-grade-field="recovery"]').value);
    const absences = Number(row.querySelector('[data-grade-field="absences"]').value || 0);
    const note = row.querySelector('[data-grade-field="note"]').value.trim();
    return { grade: grade, recoveryGrade: recoveryGrade, absences: absences, note: note };
  }

  function validateRow(values, studentName) {
    if (Number.isNaN(values.grade) || (values.grade !== null && (values.grade < 0 || values.grade > 10))) return `A nota de ${studentName} deve estar entre 0 e 10.`;
    if (Number.isNaN(values.recoveryGrade) || (values.recoveryGrade !== null && (values.recoveryGrade < 0 || values.recoveryGrade > 10))) return `A recuperação de ${studentName} deve estar entre 0 e 10.`;
    if (!Number.isInteger(values.absences) || values.absences < 0 || values.absences > 999) return `Revise as faltas de ${studentName}.`;
    return "";
  }

  async function saveRegister(status) {
    const context = contextValues();
    const button = status === "published" ? document.getElementById("grades-publish") : document.getElementById("grades-save-draft");
    if (!context.turma || !context.subject) {
      setFeedback("grades-feedback", "Selecione uma turma e uma disciplina.", "error");
      return;
    }

    const rows = [...document.querySelectorAll("[data-grade-student]")];
    const payloads = [];
    for (const row of rows) {
      const student = state.currentStudents.find(function (item) { return String(item.id) === String(row.dataset.gradeStudent); });
      if (!student) continue;
      const values = readStudentRow(row);
      const error = validateRow(values, student.nome);
      if (error) { setFeedback("grades-feedback", error, "error"); return; }
      const current = matchingGrade(student.id, context);
      const hasContent = values.grade !== null || values.recoveryGrade !== null || values.absences > 0 || values.note;
      if (!current && !hasContent) continue;
      payloads.push({
        id: current?.id || createId(),
        academicYear: context.academicYear,
        period: context.period,
        turma: context.turma,
        subject: context.subject,
        studentId: student.id,
        studentName: student.nome,
        grade: values.grade,
        recoveryGrade: values.recoveryGrade,
        absences: values.absences,
        note: values.note,
        status: status === "published" && (values.grade !== null || values.recoveryGrade !== null) ? "published" : "draft",
        teacherUserId: current?.teacherUserId || state.session.userId || null,
        teacherName: current?.teacherName || state.session.name || "",
        createdAt: current?.createdAt || new Date().toISOString()
      });
    }

    if (!payloads.length) {
      setFeedback("grades-feedback", "Preencha pelo menos uma nota antes de salvar.", "error");
      return;
    }

    button.disabled = true;
    setFeedback("grades-feedback", status === "published" ? "Publicando notas..." : "Salvando rascunho...");
    try {
      const savedItems = [];
      for (const payload of payloads) savedItems.push(await window.AgendaGamaDataStore.save("grades", payload, []));
      const savedIds = new Set(savedItems.map(function (item) { return item.id; }));
      state.grades = [...savedItems, ...state.grades.filter(function (item) { return !savedIds.has(item.id); })];
      populateYearSelectorsPreservingValues();
      renderRegister();
      setFeedback("grades-feedback", status === "published" ? "Notas publicadas para os responsáveis." : "Rascunho salvo.", "success");
    } catch (error) {
      setFeedback("grades-feedback", error?.message || "Não foi possível salvar as notas.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function populateYearSelectorsPreservingValues() {
    const gradeYear = document.getElementById("grades-year").value;
    const reportYear = document.getElementById("report-year").value;
    document.getElementById("grades-year").innerHTML = yearOptions(gradeYear);
    document.getElementById("report-year").innerHTML = yearOptions(reportYear);
  }

  function effectiveGrade(grade) {
    const values = [grade?.grade, grade?.recoveryGrade].filter(function (value) { return value !== null && value !== undefined && Number.isFinite(Number(value)); }).map(Number);
    return values.length ? Math.max(...values) : null;
  }

  function formatGrade(value) {
    return value === null || value === undefined ? "--" : Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  function renderReport() {
    const studentId = document.getElementById("report-student").value;
    const year = Number(document.getElementById("report-year").value);
    const student = state.students.find(function (item) { return String(item.id) === String(studentId); });
    if (!student) {
      document.getElementById("report-sheet").hidden = true;
      setFeedback("report-feedback", "Nenhum aluno disponível para gerar o boletim.", "error");
      return false;
    }

    const records = state.grades.filter(function (grade) {
      return String(grade.studentId) === String(student.id) && Number(grade.academicYear) === year && grade.status === "published";
    });
    const subjects = [...new Set(records.map(function (grade) { return grade.subject; }).filter(Boolean))].sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    document.getElementById("report-year-label").textContent = year;
    document.getElementById("report-student-name").textContent = student.nome || "";
    document.getElementById("report-student-turma").textContent = student.turma || "--";
    document.getElementById("report-student-registration").textContent = student.matricula || "--";
    document.getElementById("report-issued-at").textContent = `Emitido em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}`;

    const tableBody = document.getElementById("report-table-body");
    tableBody.innerHTML = subjects.map(function (subject) {
      const subjectRecords = records.filter(function (grade) { return normalize(grade.subject) === normalize(subject); });
      const periodValues = [1, 2, 3, 4].map(function (period) {
        return effectiveGrade(subjectRecords.find(function (grade) { return Number(grade.period) === period; }));
      });
      const available = periodValues.filter(function (value) { return value !== null; });
      const average = available.length ? available.reduce(function (sum, value) { return sum + value; }, 0) / available.length : null;
      const absences = subjectRecords.reduce(function (sum, grade) { return sum + Number(grade.absences || 0); }, 0);
      const situation = available.length < 4 ? "Em andamento" : average >= PASSING_GRADE ? "Aprovado" : "Recuperação";
      const situationClass = situation === "Aprovado" ? "is-approved" : situation === "Recuperação" ? "is-recovery" : "";
      return `<tr><th>${escapeHtml(subject)}</th>${periodValues.map(function (value) { return `<td>${escapeHtml(formatGrade(value))}</td>`; }).join("")}<td><strong>${escapeHtml(formatGrade(average))}</strong></td><td>${absences}</td><td><span class="report-situation ${situationClass}">${escapeHtml(situation)}</span></td></tr>`;
    }).join("");

    const notes = records.filter(function (grade) { return grade.note; }).sort(function (a, b) { return Number(a.period) - Number(b.period); });
    document.getElementById("report-notes").innerHTML = notes.length
      ? `<h2>Observações</h2>${notes.map(function (grade) { return `<p><strong>${escapeHtml(grade.subject)} · ${grade.period}º bimestre:</strong> ${escapeHtml(grade.note)}</p>`; }).join("")}`
      : "";
    document.getElementById("report-empty").hidden = subjects.length > 0;
    document.getElementById("report-sheet").hidden = false;
    setFeedback("report-feedback", subjects.length ? "" : "Ainda não há notas publicadas neste ano.");
    return subjects.length > 0;
  }

  function showView(view) {
    const entryView = document.getElementById("grades-entry-view");
    const reportView = document.getElementById("grades-report-view");
    entryView.hidden = view !== "entry";
    reportView.hidden = view !== "report";
    document.querySelectorAll("[data-grades-view]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.gradesView === view); });
    if (view === "report") renderReport();
  }

  function bindEvents() {
    document.getElementById("grades-load").addEventListener("click", renderRegister);
    document.getElementById("grades-save-draft").addEventListener("click", function () { saveRegister("draft"); });
    document.getElementById("grades-publish").addEventListener("click", function () { saveRegister("published"); });
    document.getElementById("report-open").addEventListener("click", renderReport);
    document.getElementById("report-student").addEventListener("change", renderReport);
    document.getElementById("report-year").addEventListener("change", renderReport);
    document.getElementById("report-print").addEventListener("click", function () {
      if (renderReport()) window.print();
    });
    document.querySelectorAll("[data-grades-view]").forEach(function (button) { button.addEventListener("click", function () { showView(button.dataset.gradesView); }); });
  }

  async function safeList(key) {
    try { return await window.AgendaGamaDataStore.list(key, []); }
    catch (error) { console.warn(`[Agenda Gama] Não foi possível carregar ${key} em notas.`, error); return []; }
  }

  async function init(session) {
    state.session = session;
    const manager = isManager();
    document.getElementById("grades-description").textContent = manager ? "Lance notas por turma e gere boletins prontos para impressão." : "Consulte e imprima os boletins dos seus filhos.";
    document.getElementById("grades-tabs").hidden = !manager;
    try {
      const results = await Promise.all([safeList("alunos"), safeList("turmas"), safeList("disciplinas"), safeList("professores"), safeList("grades")]);
      state.students = results[0] || [];
      state.turmas = results[1] || [];
      state.disciplinas = results[2] || [];
      state.professores = results[3] || [];
      state.grades = results[4] || [];
      populateControls();
      bindEvents();
      if (manager) {
        showView("entry");
        if (state.turmas.length && availableSubjects().length) renderRegister();
        else setFeedback("grades-feedback", isTeacher() ? "Confirme as turmas e disciplinas vinculadas ao seu cadastro." : "Cadastre turmas, alunos e disciplinas para lançar notas.");
      } else {
        showView("report");
      }
    } catch (error) {
      setFeedback(manager ? "grades-feedback" : "report-feedback", error?.message || "Não foi possível carregar as notas.", "error");
    }
  }

  function mount() {
    const start = function (session) { if (session && window.AgendaGamaDataStore) init(session); };
    if (document.getElementById("grades-report-view")) start(window.AgendaGamaAuth?.getSession?.());
    else window.addEventListener("agenda-shell-ready", function (event) { start(event.detail?.session || window.AgendaGamaAuth?.getSession?.()); }, { once: true });
  }

  window.AgendaGamaGradebook = { mount: mount };
})();
