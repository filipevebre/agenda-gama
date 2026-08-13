(function () {
  const STATUS_LABELS = {
    present: "Presente",
    absent: "Falta",
    late: "Atraso",
    excused: "Justificada"
  };

  const state = {
    session: null,
    students: [],
    turmas: [],
    sessions: [],
    records: [],
    currentSession: null,
    currentStudents: [],
    draft: new Map()
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function createId(prefix) {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function dateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function parseDate(value) {
    const parts = String(value || "").split("-").map(Number);
    return parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function formatPeriodDate(value) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("pt-BR");
  }

  function isManager() {
    return ["administrador", "funcionarios", "professores"].includes(state.session?.role);
  }

  function setFeedback(message, type) {
    const feedback = document.getElementById("attendance-feedback");
    feedback.textContent = message || "";
    feedback.className = `feedback${type ? ` ${type}` : ""}`;
  }

  function sessionForRecord(record) {
    return state.sessions.find(function (session) { return String(session.id) === String(record.sessionId); }) || null;
  }

  function uniqueTurmaNames() {
    return [...new Set([
      ...state.turmas.map(function (turma) { return turma.nome; }),
      ...state.students.map(function (student) { return student.turma; }),
      ...state.sessions.map(function (session) { return session.turma; })
    ].filter(Boolean))].sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
  }

  function sortedStudents(turma) {
    return state.students.filter(function (student) {
      return !turma || turma === "all" || normalize(student.turma) === normalize(turma);
    }).sort(function (a, b) { return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"); });
  }

  function populateStudentFilter() {
    const turma = document.getElementById("attendance-turma-filter").value;
    const studentFilter = document.getElementById("attendance-student-filter");
    const selected = studentFilter.value || "all";
    const students = sortedStudents(turma);
    studentFilter.innerHTML = `<option value="all">Todos os alunos</option>${students.map(function (student) {
      return `<option value="${escapeHtml(student.id)}">${escapeHtml(student.nome)}${student.turma ? ` · ${escapeHtml(student.turma)}` : ""}</option>`;
    }).join("")}`;
    studentFilter.value = students.some(function (student) { return String(student.id) === String(selected); }) ? selected : "all";
  }

  function populateSelectors() {
    const turmaNames = uniqueTurmaNames();
    const callTurmaSelect = document.getElementById("attendance-turma");
    callTurmaSelect.innerHTML = turmaNames.length
      ? turmaNames.map(function (name) { return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; }).join("")
      : `<option value="">Nenhuma turma disponível</option>`;

    const reportTurmaSelect = document.getElementById("attendance-turma-filter");
    reportTurmaSelect.innerHTML = `<option value="all">Todas as turmas</option>${turmaNames.map(function (name) {
      return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    }).join("")}`;

    const currentYear = new Date().getFullYear();
    const years = [...new Set([
      currentYear,
      ...state.sessions.map(function (session) { return Number(String(session.attendanceDate || "").slice(0, 4)); }).filter(Boolean)
    ])].sort(function (a, b) { return b - a; });
    const yearSelect = document.getElementById("attendance-year-filter");
    yearSelect.innerHTML = years.map(function (year) { return `<option value="${year}">${year}</option>`; }).join("");
    yearSelect.value = String(currentYear);

    const now = new Date();
    document.getElementById("attendance-month-filter").value = String(now.getMonth() + 1);
    document.getElementById("attendance-bimester-filter").value = String(Math.ceil((now.getMonth() + 1) / 3));
    document.getElementById("attendance-semester-filter").value = now.getMonth() < 6 ? "1" : "2";
    document.getElementById("attendance-start-filter").value = dateKey(currentYear, now.getMonth() + 1, 1);
    document.getElementById("attendance-end-filter").value = dateKey(currentYear, now.getMonth() + 1, lastDayOfMonth(currentYear, now.getMonth() + 1));
    populateStudentFilter();
  }

  function currentCallValues() {
    const date = document.getElementById("attendance-date").value;
    const turma = document.getElementById("attendance-turma").value;
    return { date: date, turma: turma };
  }

  function recordForStudent(studentId) {
    if (!state.currentSession) return null;
    return state.records.find(function (record) {
      return String(record.sessionId) === String(state.currentSession.id) && String(record.studentId) === String(studentId);
    }) || null;
  }

  function renderStudentList() {
    const list = document.getElementById("attendance-student-list");
    list.innerHTML = state.currentStudents.map(function (student) {
      const status = state.draft.get(String(student.id)) || "present";
      return `
        <article class="attendance-student-row" data-attendance-student="${escapeHtml(student.id)}">
          <span class="attendance-student-avatar">${escapeHtml(String(student.nome || "A").trim().slice(0, 1).toUpperCase())}</span>
          <span class="attendance-student-name"><strong>${escapeHtml(student.nome)}</strong><small>${escapeHtml(student.turma || "Sem turma")}</small></span>
          <div class="attendance-status-options" role="group" aria-label="Presença de ${escapeHtml(student.nome)}">
            ${Object.entries(STATUS_LABELS).map(function (entry) {
              const key = entry[0];
              return `<button type="button" class="attendance-status status-${key} ${key === status ? "is-active" : ""}" data-attendance-status="${key}" title="${escapeHtml(entry[1])}"><span></span><b>${escapeHtml(entry[1])}</b></button>`;
            }).join("")}
          </div>
        </article>`;
    }).join("");
  }

  function openCall() {
    const values = currentCallValues();
    if (!values.date || !values.turma) {
      setFeedback("Selecione a data e a turma.", "error");
      return;
    }
    state.currentStudents = sortedStudents(values.turma);
    state.currentSession = state.sessions.find(function (session) {
      return session.attendanceDate === values.date && normalize(session.turma) === normalize(values.turma);
    }) || null;
    state.draft = new Map();
    state.currentStudents.forEach(function (student) {
      state.draft.set(String(student.id), recordForStudent(student.id)?.status || "present");
    });

    const hasStudents = state.currentStudents.length > 0;
    document.getElementById("attendance-call").hidden = !hasStudents;
    document.getElementById("attendance-no-students").hidden = hasStudents;
    if (!hasStudents) {
      setFeedback("");
      return;
    }
    document.getElementById("attendance-call-title").textContent = `${values.turma} · ${formatDate(values.date)}`;
    document.getElementById("attendance-call-status").textContent = state.currentSession ? "Chamada salva" : "Nova chamada";
    document.getElementById("attendance-call-status").className = `status-badge ${state.currentSession ? "success" : ""}`;
    document.getElementById("attendance-call-summary").textContent = `${state.currentStudents.length} aluno(s)`;
    document.getElementById("attendance-notes").value = state.currentSession?.notes || "";
    renderStudentList();
    setFeedback("");
  }

  function updateStudentStatus(studentId, status) {
    state.draft.set(String(studentId), status);
    const row = document.querySelector(`[data-attendance-student="${CSS.escape(String(studentId))}"]`);
    row?.querySelectorAll("[data-attendance-status]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.attendanceStatus === status);
    });
  }

  function setView(view) {
    const showReport = view === "report";
    document.getElementById("attendance-manager").hidden = showReport;
    document.getElementById("attendance-history-section").hidden = !showReport;
    document.querySelectorAll("[data-attendance-view]").forEach(function (button) {
      const active = button.dataset.attendanceView === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function statusCounts(records) {
    return records.reduce(function (counts, record) {
      counts[record.status] = (counts[record.status] || 0) + 1;
      return counts;
    }, {});
  }

  function periodBounds() {
    const period = document.getElementById("attendance-period-filter").value;
    const year = Number(document.getElementById("attendance-year-filter").value) || new Date().getFullYear();
    let start;
    let end;

    if (period === "month") {
      const month = Number(document.getElementById("attendance-month-filter").value);
      start = dateKey(year, month, 1);
      end = dateKey(year, month, lastDayOfMonth(year, month));
    } else if (period === "bimester") {
      const bimester = Number(document.getElementById("attendance-bimester-filter").value);
      const startMonth = ((bimester - 1) * 3) + 1;
      const endMonth = startMonth + 2;
      start = dateKey(year, startMonth, 1);
      end = dateKey(year, endMonth, lastDayOfMonth(year, endMonth));
    } else if (period === "semester") {
      const semester = Number(document.getElementById("attendance-semester-filter").value);
      const startMonth = semester === 1 ? 1 : 7;
      const endMonth = semester === 1 ? 6 : 12;
      start = dateKey(year, startMonth, 1);
      end = dateKey(year, endMonth, lastDayOfMonth(year, endMonth));
    } else if (period === "custom") {
      start = document.getElementById("attendance-start-filter").value;
      end = document.getElementById("attendance-end-filter").value;
    } else {
      start = dateKey(year, 1, 1);
      end = dateKey(year, 12, 31);
    }

    return { start: start, end: end };
  }

  function updatePeriodFields() {
    const period = document.getElementById("attendance-period-filter").value;
    document.getElementById("attendance-year-filter").closest("label").hidden = period === "custom";
    document.getElementById("attendance-month-field").hidden = period !== "month";
    document.getElementById("attendance-bimester-field").hidden = period !== "bimester";
    document.getElementById("attendance-semester-field").hidden = period !== "semester";
    document.getElementById("attendance-start-field").hidden = period !== "custom";
    document.getElementById("attendance-end-field").hidden = period !== "custom";
  }

  function filteredRecords() {
    const bounds = periodBounds();
    const turma = document.getElementById("attendance-turma-filter").value;
    const studentId = document.getElementById("attendance-student-filter").value;
    return state.records.filter(function (record) {
      const session = sessionForRecord(record);
      if (!session?.attendanceDate) return false;
      if (bounds.start && session.attendanceDate < bounds.start) return false;
      if (bounds.end && session.attendanceDate > bounds.end) return false;
      if (turma !== "all" && normalize(session.turma) !== normalize(turma)) return false;
      return studentId === "all" || String(record.studentId) === String(studentId);
    }).sort(function (left, right) {
      const leftSession = sessionForRecord(left);
      const rightSession = sessionForRecord(right);
      return String(rightSession?.attendanceDate || right.createdAt || "").localeCompare(String(leftSession?.attendanceDate || left.createdAt || ""));
    });
  }

  function attendanceRate(records) {
    if (!records.length) return 0;
    const attended = records.filter(function (record) { return record.status === "present" || record.status === "late"; }).length;
    return Math.round((attended / records.length) * 100);
  }

  function renderStats(records) {
    const counts = statusCounts(records);
    const sessions = new Set(records.map(function (record) { return String(record.sessionId); }));
    document.getElementById("attendance-stat-sessions").textContent = sessions.size;
    document.getElementById("attendance-stat-present").textContent = counts.present || 0;
    document.getElementById("attendance-stat-absent").textContent = counts.absent || 0;
    document.getElementById("attendance-stat-late").textContent = counts.late || 0;
    document.getElementById("attendance-stat-rate").textContent = `${attendanceRate(records)}%`;
  }

  function summarizeByStudent(records) {
    const summaries = new Map();
    records.forEach(function (record) {
      const session = sessionForRecord(record);
      const key = String(record.studentId || record.studentName);
      if (!summaries.has(key)) {
        summaries.set(key, { studentName: record.studentName || "Aluno", turmas: new Set(), records: [] });
      }
      const summary = summaries.get(key);
      if (session?.turma) summary.turmas.add(session.turma);
      summary.records.push(record);
    });
    return [...summaries.values()].sort(function (a, b) { return a.studentName.localeCompare(b.studentName, "pt-BR"); });
  }

  function renderSummary(records) {
    const summaries = summarizeByStudent(records);
    const summaryElement = document.getElementById("attendance-summary");
    const empty = document.getElementById("attendance-summary-empty");
    document.getElementById("attendance-summary-count").textContent = `${summaries.length} aluno(s)`;
    empty.hidden = summaries.length > 0;
    summaryElement.innerHTML = summaries.map(function (summary) {
      const counts = statusCounts(summary.records);
      const turmas = [...summary.turmas].join(", ") || "Sem turma";
      const rate = attendanceRate(summary.records);
      const rateClass = rate >= 75 ? "is-good" : rate >= 60 ? "is-warning" : "is-low";
      return `
        <article class="attendance-summary-row" role="row">
          <span class="attendance-summary-name" role="cell" data-label="Aluno"><strong>${escapeHtml(summary.studentName)}</strong><small>${escapeHtml(turmas)}</small></span>
          <span role="cell" data-label="Chamadas">${summary.records.length}</span>
          <span role="cell" data-label="Presenças">${counts.present || 0}</span>
          <span role="cell" data-label="Faltas">${counts.absent || 0}</span>
          <span role="cell" data-label="Justificadas">${counts.excused || 0}</span>
          <span role="cell" data-label="Atrasos">${counts.late || 0}</span>
          <span role="cell" data-label="Frequência"><b class="attendance-rate ${rateClass}">${rate}%</b></span>
        </article>`;
    }).join("");
  }

  function renderHistory() {
    const records = filteredRecords();
    const bounds = periodBounds();
    document.getElementById("attendance-period-label").textContent = bounds.start && bounds.end
      ? `${formatPeriodDate(bounds.start)} a ${formatPeriodDate(bounds.end)}`
      : "Selecione as datas";
    document.getElementById("attendance-record-count").textContent = `${records.length} registro(s)`;

    const history = document.getElementById("attendance-history");
    const empty = document.getElementById("attendance-history-empty");
    empty.hidden = records.length > 0;
    history.innerHTML = records.map(function (record) {
      const session = sessionForRecord(record);
      return `
        <article class="attendance-history-row">
          <span class="attendance-history-date"><strong>${escapeHtml(formatDate(session?.attendanceDate || ""))}</strong><small>${escapeHtml(session?.turma || "Turma")}</small></span>
          <span class="attendance-history-student"><strong>${escapeHtml(record.studentName)}</strong>${record.note ? `<small>${escapeHtml(record.note)}</small>` : ""}</span>
          <span class="attendance-history-status status-${escapeHtml(record.status)}">${escapeHtml(STATUS_LABELS[record.status] || record.status)}</span>
        </article>`;
    }).join("");
    renderSummary(records);
    renderStats(records);
  }

  async function saveCall() {
    if (!state.currentStudents.length) return;
    const button = document.getElementById("attendance-save");
    const values = currentCallValues();
    button.disabled = true;
    setFeedback("Salvando chamada...");
    try {
      const sessionPayload = {
        id: state.currentSession?.id || createId("attendance-session"),
        attendanceDate: values.date,
        turma: values.turma,
        status: "completed",
        notes: document.getElementById("attendance-notes").value.trim(),
        teacherUserId: state.currentSession?.teacherUserId || state.session.userId || null,
        teacherName: state.currentSession?.teacherName || state.session.name || "",
        createdAt: state.currentSession?.createdAt || new Date().toISOString()
      };
      const savedSession = await window.AgendaGamaDataStore.save("attendanceSessions", sessionPayload, []);
      state.sessions = [savedSession, ...state.sessions.filter(function (item) { return item.id !== savedSession.id; })];
      state.currentSession = savedSession;

      const savedRecords = [];
      for (const student of state.currentStudents) {
        const current = recordForStudent(student.id);
        const payload = {
          id: current?.id || createId("attendance-record"),
          sessionId: savedSession.id,
          studentId: student.id,
          studentName: student.nome,
          status: state.draft.get(String(student.id)) || "present",
          note: current?.note || "",
          recordedByUserId: current?.recordedByUserId || state.session.userId || null,
          recordedByName: current?.recordedByName || state.session.name || "",
          createdAt: current?.createdAt || new Date().toISOString()
        };
        savedRecords.push(await window.AgendaGamaDataStore.save("attendanceRecords", payload, []));
      }
      const savedIds = new Set(savedRecords.map(function (record) { return record.id; }));
      state.records = [...savedRecords, ...state.records.filter(function (record) { return !savedIds.has(record.id); })];
      document.getElementById("attendance-call-status").textContent = "Chamada salva";
      document.getElementById("attendance-call-status").className = "status-badge success";
      setFeedback("Chamada salva com sucesso.", "success");
      renderHistory();
    } catch (error) {
      setFeedback(error?.message || "Não foi possível salvar a chamada.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    document.getElementById("attendance-load").addEventListener("click", openCall);
    document.getElementById("attendance-all-present").addEventListener("click", function () {
      state.currentStudents.forEach(function (student) { state.draft.set(String(student.id), "present"); });
      renderStudentList();
    });
    document.getElementById("attendance-save").addEventListener("click", saveCall);
    document.getElementById("attendance-student-list").addEventListener("click", function (event) {
      const button = event.target.closest("[data-attendance-status]");
      const row = event.target.closest("[data-attendance-student]");
      if (button && row) updateStudentStatus(row.dataset.attendanceStudent, button.dataset.attendanceStatus);
    });

    document.getElementById("attendance-period-filter").addEventListener("change", function () {
      updatePeriodFields();
      renderHistory();
    });
    ["attendance-year-filter", "attendance-month-filter", "attendance-bimester-filter", "attendance-semester-filter", "attendance-start-filter", "attendance-end-filter", "attendance-student-filter"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", renderHistory);
    });
    document.getElementById("attendance-turma-filter").addEventListener("change", function () {
      populateStudentFilter();
      renderHistory();
    });
    document.getElementById("attendance-view-switch").addEventListener("click", function (event) {
      const button = event.target.closest("[data-attendance-view]");
      if (button) setView(button.dataset.attendanceView);
    });
  }

  async function init(session) {
    state.session = session;
    const manager = isManager();
    document.getElementById("attendance-view-switch").hidden = !manager;
    document.getElementById("attendance-manager").hidden = !manager;
    document.getElementById("attendance-description").textContent = manager ? "Registre chamadas e consulte a frequência de qualquer período." : "Acompanhe a frequência escolar dos seus filhos por período.";
    document.getElementById("attendance-history-title").textContent = manager ? "Frequência por período" : "Frequência dos seus filhos";
    if (manager) document.getElementById("attendance-date").value = todayKey();

    try {
      const results = await Promise.all([
        window.AgendaGamaDataStore.list("alunos", []),
        window.AgendaGamaDataStore.list("turmas", []),
        window.AgendaGamaDataStore.list("attendanceSessions", []),
        window.AgendaGamaDataStore.list("attendanceRecords", [])
      ]);
      state.students = results[0] || [];
      state.turmas = results[1] || [];
      state.sessions = results[2] || [];
      state.records = results[3] || [];
      populateSelectors();
      updatePeriodFields();
      bindEvents();
      renderHistory();
      if (manager) setView("call");
      if (manager && state.turmas.length) openCall();
    } catch (error) {
      if (manager) setFeedback(error?.message || "Não foi possível carregar a frequência.", "error");
      document.getElementById("attendance-history-empty").hidden = false;
      document.getElementById("attendance-history-empty").textContent = error?.message || "Não foi possível carregar a frequência.";
    }
  }

  function mount() {
    const start = function (session) { if (session && window.AgendaGamaDataStore) init(session); };
    if (document.getElementById("attendance-history")) start(window.AgendaGamaAuth?.getSession?.());
    else window.addEventListener("agenda-shell-ready", function (event) { start(event.detail?.session || window.AgendaGamaAuth?.getSession?.()); }, { once: true });
  }

  window.AgendaGamaAttendance = { mount: mount };
})();
