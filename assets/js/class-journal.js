(function () {
  const state = {
    session: null,
    entries: [],
    turmas: [],
    disciplinas: [],
    professores: [],
    editingId: null
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
  }

  function parseList(value) {
    return String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `class-journal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentMonth() {
    return today().slice(0, 7);
  }

  function isTeacher() {
    return state.session?.role === "professores";
  }

  function currentProfessor() {
    return state.professores.find(function (professor) {
      return (state.session?.userId && String(professor.auth_user_id || "") === String(state.session.userId))
        || normalize(professor.email) === normalize(state.session?.email)
        || normalize(professor.nome) === normalize(state.session?.name);
    }) || null;
  }

  function availableTurmas() {
    if (!isTeacher()) return state.turmas;
    const allowed = parseList(currentProfessor()?.turmas).map(normalize);
    return state.turmas.filter(function (turma) {
      return allowed.some(function (name) { return name === normalize(turma.nome) || normalize(turma.nome).startsWith(name) || name.startsWith(normalize(turma.nome)); });
    });
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

  function setFeedback(id, message, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message || "";
    element.className = `feedback${type ? ` ${type}` : ""}`;
  }

  function formatDate(dateValue) {
    if (!dateValue) return "Data não informada";
    return new Date(`${dateValue}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }

  function dateParts(dateValue) {
    if (!dateValue) return { day: "--", month: "" };
    const date = new Date(`${dateValue}T12:00:00`);
    return {
      day: String(date.getDate()).padStart(2, "0"),
      month: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
    };
  }

  function canEdit(entry) {
    return !isTeacher() || String(entry.teacherUserId || "") === String(state.session?.userId || "");
  }

  function filteredEntries() {
    const search = normalize(document.getElementById("class-journal-search").value);
    const month = document.getElementById("class-journal-month").value;
    const turma = document.getElementById("class-journal-filter-class").value;
    const subject = document.getElementById("class-journal-filter-subject").value;
    return state.entries.filter(function (entry) {
      if (month && !String(entry.lessonDate || "").startsWith(month)) return false;
      if (turma !== "all" && normalize(entry.turma) !== normalize(turma)) return false;
      if (subject !== "all" && normalize(entry.subject) !== normalize(subject)) return false;
      if (search && !normalize([entry.topic, entry.summary, entry.homework, entry.teacherName, entry.turma, entry.subject].join(" ")).includes(search)) return false;
      return true;
    }).sort(function (left, right) {
      return String(right.lessonDate || "").localeCompare(String(left.lessonDate || ""))
        || String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    });
  }

  function renderStats() {
    document.getElementById("class-journal-total").textContent = state.entries.length;
    document.getElementById("class-journal-today").textContent = state.entries.filter(function (entry) { return entry.lessonDate === today(); }).length;
    document.getElementById("class-journal-classes").textContent = new Set(state.entries.map(function (entry) { return normalize(entry.turma); }).filter(Boolean)).size;
  }

  function renderList() {
    const entries = filteredEntries();
    const list = document.getElementById("class-journal-list");
    const empty = document.getElementById("class-journal-empty");
    list.innerHTML = entries.map(function (entry) {
      const parts = dateParts(entry.lessonDate);
      const actions = canEdit(entry) ? `
        <div class="class-journal-entry-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-class-journal-edit="${escapeHtml(entry.id)}">Editar</button>
          <button class="btn btn-secondary btn-sm danger" type="button" data-class-journal-delete="${escapeHtml(entry.id)}">Excluir</button>
        </div>` : "";
      return `
        <article class="class-journal-entry">
          <time class="class-journal-entry-date" datetime="${escapeHtml(entry.lessonDate)}"><strong>${escapeHtml(parts.day)}</strong><span>${escapeHtml(parts.month)}</span></time>
          <div class="class-journal-entry-main">
            <div class="class-journal-entry-tags"><span>${escapeHtml(entry.subject)}</span><span>${escapeHtml(entry.turma)}</span></div>
            <h3>${escapeHtml(entry.topic)}</h3>
            <p class="class-journal-entry-summary">${escapeHtml(entry.summary)}</p>
            <div class="class-journal-entry-meta"><span>${escapeHtml(formatDate(entry.lessonDate))}</span><span>Professor(a): ${escapeHtml(entry.teacherName || "Não informado")}</span>${entry.homework ? "<span>Com atividade</span>" : ""}</div>
          </div>
          ${actions}
        </article>`;
    }).join("");
    empty.hidden = entries.length > 0;
  }

  function fillSelect(select, values, emptyLabel) {
    select.innerHTML = values.length
      ? values.map(function (value) { return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`; }).join("")
      : `<option value="">${escapeHtml(emptyLabel)}</option>`;
  }

  function populateControls() {
    const turmaNames = availableTurmas().map(function (turma) { return turma.nome; }).filter(Boolean).sort(function (left, right) { return left.localeCompare(right, "pt-BR"); });
    const subjects = availableSubjects();
    fillSelect(document.getElementById("class-journal-class"), turmaNames, "Nenhuma turma vinculada");
    fillSelect(document.getElementById("class-journal-subject"), subjects, "Nenhuma matéria vinculada");
    document.getElementById("class-journal-filter-class").innerHTML = `<option value="all">Todas</option>${turmaNames.map(function (name) { return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; }).join("")}`;
    document.getElementById("class-journal-filter-subject").innerHTML = `<option value="all">Todas</option>${subjects.map(function (name) { return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; }).join("")}`;
  }

  function setModalOpen(open) {
    document.getElementById("class-journal-modal").hidden = !open;
    document.body.classList.toggle("app-modal-open", open);
  }

  function openEditor(entry) {
    state.editingId = entry?.id || null;
    document.getElementById("class-journal-modal-title").textContent = entry ? "Editar conteúdo" : "Novo conteúdo";
    document.getElementById("class-journal-date").value = entry?.lessonDate || today();
    document.getElementById("class-journal-class").value = entry?.turma || document.getElementById("class-journal-class").options[0]?.value || "";
    document.getElementById("class-journal-subject").value = entry?.subject || document.getElementById("class-journal-subject").options[0]?.value || "";
    document.getElementById("class-journal-topic").value = entry?.topic || "";
    document.getElementById("class-journal-summary").value = entry?.summary || "";
    document.getElementById("class-journal-homework").value = entry?.homework || "";
    setFeedback("class-journal-feedback", "");
    setModalOpen(true);
    window.setTimeout(function () { document.getElementById("class-journal-topic").focus(); }, 80);
  }

  function closeEditor() {
    setModalOpen(false);
    state.editingId = null;
    document.getElementById("class-journal-form").reset();
  }

  async function saveEntry(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = state.entries.find(function (entry) { return entry.id === state.editingId; }) || null;
    const payload = {
      id: current?.id || createId(),
      lessonDate: String(form.get("lessonDate") || ""),
      turma: String(form.get("turma") || "").trim(),
      subject: String(form.get("subject") || "").trim(),
      topic: String(form.get("topic") || "").trim(),
      summary: String(form.get("summary") || "").trim(),
      homework: String(form.get("homework") || "").trim(),
      teacherUserId: current?.teacherUserId || state.session?.userId || null,
      teacherName: current?.teacherName || state.session?.name || "",
      createdAt: current?.createdAt || new Date().toISOString()
    };
    if (!payload.lessonDate || !payload.turma || !payload.subject || !payload.topic || !payload.summary) {
      setFeedback("class-journal-feedback", "Preencha a data, a turma, a matéria, o conteúdo e o resumo.", "error");
      return;
    }
    const button = document.getElementById("class-journal-save");
    button.disabled = true;
    button.textContent = "Salvando...";
    try {
      await window.AgendaGamaDataStore.save("classJournal", payload, []);
      state.entries = await window.AgendaGamaDataStore.list("classJournal", []);
      closeEditor();
      renderStats();
      renderList();
      setFeedback("class-journal-board-feedback", current ? "Conteúdo atualizado com sucesso." : "Conteúdo registrado com sucesso.", "success");
    } catch (error) {
      setFeedback("class-journal-feedback", error?.message || "Não foi possível salvar o conteúdo.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Salvar conteúdo";
    }
  }

  async function deleteEntry(entry) {
    if (!entry || !window.confirm(`Excluir o conteúdo “${entry.topic}”?`)) return;
    try {
      await window.AgendaGamaDataStore.remove("classJournal", entry.id, []);
      state.entries = state.entries.filter(function (item) { return item.id !== entry.id; });
      renderStats();
      renderList();
      setFeedback("class-journal-board-feedback", "Conteúdo excluído.", "success");
    } catch (error) {
      setFeedback("class-journal-board-feedback", error?.message || "Não foi possível excluir o conteúdo.", "error");
    }
  }

  function bindEvents() {
    document.getElementById("class-journal-open").addEventListener("click", function () { openEditor(null); });
    document.getElementById("class-journal-close").addEventListener("click", closeEditor);
    document.getElementById("class-journal-cancel").addEventListener("click", closeEditor);
    document.getElementById("class-journal-modal").addEventListener("click", function (event) { if (event.target.closest("[data-class-journal-close]")) closeEditor(); });
    document.getElementById("class-journal-form").addEventListener("submit", saveEntry);
    document.getElementById("class-journal-filter-toggle").addEventListener("click", function (event) {
      const filters = document.getElementById("class-journal-filters");
      filters.hidden = !filters.hidden;
      event.currentTarget.setAttribute("aria-expanded", String(!filters.hidden));
      event.currentTarget.textContent = filters.hidden ? "Filtros" : "Ocultar filtros";
    });
    ["class-journal-search", "class-journal-month", "class-journal-filter-class", "class-journal-filter-subject"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", renderList);
    });
    document.getElementById("class-journal-list").addEventListener("click", function (event) {
      const editButton = event.target.closest("[data-class-journal-edit]");
      if (editButton) {
        const entry = state.entries.find(function (item) { return item.id === editButton.dataset.classJournalEdit; });
        if (entry) openEditor(entry);
        return;
      }
      const deleteButton = event.target.closest("[data-class-journal-delete]");
      if (deleteButton) {
        const entry = state.entries.find(function (item) { return item.id === deleteButton.dataset.classJournalDelete; });
        deleteEntry(entry);
      }
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && !document.getElementById("class-journal-modal").hidden) closeEditor(); });
  }

  async function safeList(key) {
    try { return await window.AgendaGamaDataStore.list(key, []); }
    catch (error) { console.warn(`[Agenda Gama] Não foi possível carregar ${key} no conteúdo de aula.`, error); return []; }
  }

  async function init(session) {
    state.session = session;
    try {
      const results = await Promise.all([safeList("turmas"), safeList("disciplinas"), safeList("professores"), window.AgendaGamaDataStore.list("classJournal", [])]);
      state.turmas = results[0] || [];
      state.disciplinas = results[1] || [];
      state.professores = results[2] || [];
      state.entries = results[3] || [];
      populateControls();
      document.getElementById("class-journal-month").value = currentMonth();
      bindEvents();
      renderStats();
      renderList();
      if (!availableTurmas().length || !availableSubjects().length) {
        document.getElementById("class-journal-open").disabled = true;
        setFeedback("class-journal-board-feedback", isTeacher() ? "Confirme as turmas e matérias vinculadas ao cadastro da professora." : "Cadastre turmas e matérias antes de lançar o conteúdo.", "error");
      }
    } catch (error) {
      setFeedback("class-journal-board-feedback", error?.message || "Não foi possível carregar os conteúdos de aula.", "error");
      document.getElementById("class-journal-open").disabled = true;
    }
  }

  function mount() {
    const start = function (session) { if (session && window.AgendaGamaDataStore) init(session); };
    if (document.getElementById("class-journal-list")) start(window.AgendaGamaAuth?.getSession?.());
    else window.addEventListener("agenda-shell-ready", function (event) { start(event.detail?.session || window.AgendaGamaAuth?.getSession?.()); }, { once: true });
  }

  window.AgendaGamaClassJournal = { mount: mount };
})();
