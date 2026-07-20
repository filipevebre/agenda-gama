(function () {
  const TYPE_LABELS = {
    evento: "Evento",
    reuniao: "Reunião",
    prova: "Prova",
    feriado: "Feriado",
    passeio: "Passeio",
    entrega: "Entrega",
    outro: "Outro"
  };

  const state = {
    session: null,
    events: [],
    turmas: [],
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    editingId: null,
    detailId: null
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `calendar-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    const parts = String(value || "").split("-").map(Number);
    return parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
  }

  function formatDate(value, options) {
    const date = parseDate(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("pt-BR", options || { day: "2-digit", month: "long", year: "numeric" }).format(date);
  }

  function formatTime(value) {
    return value ? String(value).slice(0, 5) : "";
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("pt-BR");
  }

  function isManager() {
    return ["administrador", "funcionarios", "professores"].includes(state.session?.role);
  }

  function setFeedback(element, message, type) {
    if (!element) return;
    element.textContent = message || "";
    element.className = `feedback${type ? ` ${type}` : ""}`;
  }

  function setModalVisibility(modal, visible) {
    modal.hidden = !visible;
    document.body.classList.toggle("has-app-modal", visible || Boolean(document.querySelector(".app-modal:not([hidden])")));
  }

  function eventTouchesDate(event, dateKey) {
    const endDate = event.endDate || event.eventDate;
    return event.eventDate <= dateKey && endDate >= dateKey;
  }

  function selectedFilters() {
    return {
      type: document.getElementById("calendar-filter-type").value,
      turma: document.getElementById("calendar-filter-turma").value
    };
  }

  function filteredEvents() {
    const filters = selectedFilters();
    const start = localDateKey(new Date(state.month.getFullYear(), state.month.getMonth(), 1));
    const end = localDateKey(new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0));
    return state.events.filter(function (event) {
      const eventEnd = event.endDate || event.eventDate;
      const inMonth = event.eventDate <= end && eventEnd >= start;
      const matchesType = filters.type === "all" || event.eventType === filters.type;
      const targets = Array.isArray(event.targetTurmas) ? event.targetTurmas : [];
      const matchesTurma = filters.turma === "all" || targets.length === 0 || targets.some(function (turma) {
        return normalize(turma) === normalize(filters.turma);
      });
      return inMonth && matchesType && matchesTurma;
    }).sort(function (left, right) {
      return left.eventDate.localeCompare(right.eventDate) || String(left.startTime || "").localeCompare(String(right.startTime || ""));
    });
  }

  function eventLabel(event) {
    const time = event.allDay ? "" : formatTime(event.startTime);
    return `${time ? `${time} · ` : ""}${event.title}`;
  }

  function renderStats() {
    const today = localDateKey(new Date());
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekKey = localDateKey(nextWeek);
    const monthEvents = filteredEvents();
    document.getElementById("calendar-stat-month").textContent = monthEvents.length;
    document.getElementById("calendar-stat-important").textContent = monthEvents.filter(function (event) { return event.important; }).length;
    document.getElementById("calendar-stat-upcoming").textContent = state.events.filter(function (event) {
      return event.eventDate >= today && event.eventDate <= nextWeekKey;
    }).length;
  }

  function renderGrid(events) {
    const grid = document.getElementById("calendar-grid");
    const year = state.month.getFullYear();
    const month = state.month.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(year, month, 1 - firstDay.getDay());
    const cells = [];

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const key = localDateKey(date);
      const dateEvents = events.filter(function (event) { return eventTouchesDate(event, key); });
      const visibleEvents = dateEvents.slice(0, 3).map(function (event) {
        return `<button class="calendar-event-pill type-${escapeHtml(event.eventType)} ${event.important ? "is-important" : ""}" type="button" data-calendar-event="${escapeHtml(event.id)}" title="${escapeHtml(eventLabel(event))}">${escapeHtml(eventLabel(event))}</button>`;
      }).join("");
      cells.push(`
        <article class="calendar-day ${date.getMonth() === month ? "" : "is-outside"} ${key === localDateKey(new Date()) ? "is-today" : ""}" data-calendar-date="${key}">
          <button class="calendar-day-number" type="button" data-calendar-new-date="${key}" ${isManager() ? "" : "disabled"}>${date.getDate()}</button>
          <div class="calendar-day-events">${visibleEvents}${dateEvents.length > 3 ? `<span class="calendar-more">+${dateEvents.length - 3}</span>` : ""}</div>
        </article>`);
    }
    grid.innerHTML = cells.join("");
  }

  function renderAgenda(events) {
    const agenda = document.getElementById("calendar-agenda");
    const empty = document.getElementById("calendar-empty");
    document.getElementById("calendar-agenda-count").textContent = `${events.length} evento(s)`;
    empty.hidden = events.length > 0;
    agenda.innerHTML = events.map(function (event) {
      const targets = Array.isArray(event.targetTurmas) && event.targetTurmas.length ? event.targetTurmas.join(", ") : "Toda a escola";
      const period = event.endDate && event.endDate !== event.eventDate
        ? `${formatDate(event.eventDate, { day: "2-digit", month: "short" })} a ${formatDate(event.endDate, { day: "2-digit", month: "short" })}`
        : formatDate(event.eventDate, { weekday: "short", day: "2-digit", month: "short" });
      return `
        <button class="calendar-agenda-card ${event.important ? "is-important" : ""}" type="button" data-calendar-event="${escapeHtml(event.id)}">
          <span class="calendar-agenda-date"><strong>${escapeHtml(formatDate(event.eventDate, { day: "2-digit" }))}</strong><small>${escapeHtml(formatDate(event.eventDate, { month: "short" }))}</small></span>
          <span class="calendar-agenda-copy"><span class="calendar-agenda-meta"><b class="calendar-type type-${escapeHtml(event.eventType)}">${escapeHtml(TYPE_LABELS[event.eventType] || "Evento")}</b>${event.important ? "<b class=\"calendar-important-label\">Importante</b>" : ""}</span><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(period)}${event.allDay ? "" : ` · ${escapeHtml(formatTime(event.startTime))}`} · ${escapeHtml(targets)}</small></span>
          <span class="calendar-agenda-arrow">›</span>
        </button>`;
    }).join("");
  }

  function render() {
    const events = filteredEvents();
    document.getElementById("calendar-month-label").textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(state.month);
    renderGrid(events);
    renderAgenda(events);
    renderStats();
  }

  function renderTurmaOptions() {
    const names = [...new Set(state.turmas.map(function (turma) { return turma.nome; }).filter(Boolean))].sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    document.getElementById("calendar-filter-turma").innerHTML = `<option value="all">Todas</option>${names.map(function (name) { return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; }).join("")}`;
    document.getElementById("calendar-turma-list").innerHTML = names.length ? names.map(function (name) {
      return `<label class="calendar-turma-option"><input type="checkbox" name="calendar-turma" value="${escapeHtml(name)}"><span>${escapeHtml(name)}</span></label>`;
    }).join("") : `<p class="muted">Nenhuma turma disponível.</p>`;
  }

  function resetEditor(dateKey) {
    const form = document.getElementById("calendar-editor");
    form.reset();
    state.editingId = null;
    document.getElementById("calendar-editor-title").textContent = "Novo evento";
    document.getElementById("calendar-date").value = dateKey || localDateKey(new Date());
    document.getElementById("calendar-all-day").checked = true;
    syncTimeFields();
    setFeedback(document.getElementById("calendar-editor-feedback"), "");
  }

  function syncTimeFields() {
    const allDay = document.getElementById("calendar-all-day").checked;
    document.getElementById("calendar-start-time").disabled = allDay;
    document.getElementById("calendar-end-time").disabled = allDay;
  }

  function openEditor(event, dateKey) {
    resetEditor(dateKey);
    if (event) {
      state.editingId = event.id;
      document.getElementById("calendar-editor-title").textContent = "Editar evento";
      document.getElementById("calendar-title").value = event.title || "";
      document.getElementById("calendar-type").value = event.eventType || "evento";
      document.getElementById("calendar-date").value = event.eventDate || "";
      document.getElementById("calendar-end-date").value = event.endDate || "";
      document.getElementById("calendar-all-day").checked = event.allDay !== false;
      document.getElementById("calendar-start-time").value = formatTime(event.startTime);
      document.getElementById("calendar-end-time").value = formatTime(event.endTime);
      document.getElementById("calendar-location").value = event.location || "";
      document.getElementById("calendar-important").checked = Boolean(event.important);
      document.getElementById("calendar-description").value = event.description || "";
      const selected = new Set((event.targetTurmas || []).map(normalize));
      document.querySelectorAll('[name="calendar-turma"]').forEach(function (input) { input.checked = selected.has(normalize(input.value)); });
      syncTimeFields();
    }
    setModalVisibility(document.getElementById("calendar-editor-modal"), true);
    document.getElementById("calendar-title").focus();
  }

  function closeEditor() {
    setModalVisibility(document.getElementById("calendar-editor-modal"), false);
  }

  function canManageEvent(event) {
    if (["administrador", "funcionarios"].includes(state.session.role)) return true;
    return state.session.role === "professores" && String(event.authorUserId || "") === String(state.session.userId || "");
  }

  function openDetail(id) {
    const event = state.events.find(function (item) { return String(item.id) === String(id); });
    if (!event) return;
    state.detailId = event.id;
    document.getElementById("calendar-detail-type").textContent = TYPE_LABELS[event.eventType] || "Evento";
    document.getElementById("calendar-detail-title").textContent = event.title;
    const targets = event.targetTurmas?.length ? event.targetTurmas.join(", ") : "Toda a escola";
    const date = event.endDate && event.endDate !== event.eventDate ? `${formatDate(event.eventDate)} até ${formatDate(event.endDate)}` : formatDate(event.eventDate);
    document.getElementById("calendar-detail-content").innerHTML = `
      <div class="calendar-detail-facts">
        <span><b>Data</b>${escapeHtml(date)}</span>
        ${event.allDay ? "" : `<span><b>Horário</b>${escapeHtml(formatTime(event.startTime))}${event.endTime ? ` às ${escapeHtml(formatTime(event.endTime))}` : ""}</span>`}
        ${event.location ? `<span><b>Local</b>${escapeHtml(event.location)}</span>` : ""}
        <span><b>Público</b>${escapeHtml(targets)}</span>
      </div>
      ${event.description ? `<p class="calendar-detail-description">${escapeHtml(event.description)}</p>` : ""}`;
    document.getElementById("calendar-detail-actions").hidden = !canManageEvent(event);
    setModalVisibility(document.getElementById("calendar-detail-modal"), true);
  }

  async function saveEvent(event) {
    event.preventDefault();
    const submitter = event.submitter;
    const feedback = document.getElementById("calendar-editor-feedback");
    const current = state.events.find(function (item) { return item.id === state.editingId; });
    const targetTurmas = [...document.querySelectorAll('[name="calendar-turma"]:checked')].map(function (input) { return input.value; });
    if (state.session.role === "professores" && targetTurmas.length === 0) {
      setFeedback(feedback, "Selecione pelo menos uma turma.", "error");
      return;
    }
    const allDay = document.getElementById("calendar-all-day").checked;
    const payload = {
      id: current?.id || createId(),
      title: document.getElementById("calendar-title").value.trim(),
      description: document.getElementById("calendar-description").value.trim(),
      eventType: document.getElementById("calendar-type").value,
      status: submitter?.dataset.calendarStatus || current?.status || "published",
      eventDate: document.getElementById("calendar-date").value,
      endDate: document.getElementById("calendar-end-date").value || null,
      allDay: allDay,
      startTime: allDay ? null : document.getElementById("calendar-start-time").value || null,
      endTime: allDay ? null : document.getElementById("calendar-end-time").value || null,
      location: document.getElementById("calendar-location").value.trim(),
      targetTurmas: targetTurmas,
      important: document.getElementById("calendar-important").checked,
      authorUserId: current?.authorUserId || state.session.userId || null,
      authorName: current?.authorName || state.session.name || "",
      authorEmail: current?.authorEmail || state.session.email || "",
      createdAt: current?.createdAt || new Date().toISOString()
    };
    if (payload.endDate && payload.endDate < payload.eventDate) {
      setFeedback(feedback, "A data final não pode ser anterior à data inicial.", "error");
      return;
    }
    if (!allDay && !payload.startTime) {
      setFeedback(feedback, "Informe o horário inicial ou marque dia inteiro.", "error");
      return;
    }
    submitter.disabled = true;
    setFeedback(feedback, "Salvando evento...");
    try {
      const saved = await window.AgendaGamaDataStore.save("calendarEvents", payload, []);
      state.events = [saved, ...state.events.filter(function (item) { return item.id !== saved.id; })];
      closeEditor();
      render();
      setFeedback(document.getElementById("calendar-feedback"), payload.status === "published" ? "Evento publicado." : "Rascunho salvo.", "success");
    } catch (error) {
      setFeedback(feedback, error?.message || "Não foi possível salvar o evento.", "error");
    } finally {
      submitter.disabled = false;
    }
  }

  async function deleteEvent() {
    const event = state.events.find(function (item) { return item.id === state.detailId; });
    if (!event || !window.confirm(`Excluir o evento “${event.title}”?`)) return;
    try {
      await window.AgendaGamaDataStore.remove("calendarEvents", event.id, []);
      state.events = state.events.filter(function (item) { return item.id !== event.id; });
      setModalVisibility(document.getElementById("calendar-detail-modal"), false);
      render();
      setFeedback(document.getElementById("calendar-feedback"), "Evento excluído.", "success");
    } catch (error) {
      setFeedback(document.getElementById("calendar-feedback"), error?.message || "Não foi possível excluir o evento.", "error");
    }
  }

  function bindEvents() {
    document.getElementById("calendar-new").addEventListener("click", function () { openEditor(); });
    document.getElementById("calendar-previous").addEventListener("click", function () { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); render(); });
    document.getElementById("calendar-next").addEventListener("click", function () { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); render(); });
    document.getElementById("calendar-filter-type").addEventListener("change", render);
    document.getElementById("calendar-filter-turma").addEventListener("change", render);
    document.getElementById("calendar-all-day").addEventListener("change", syncTimeFields);
    document.getElementById("calendar-clear-turmas").addEventListener("click", function () { document.querySelectorAll('[name="calendar-turma"]').forEach(function (input) { input.checked = false; }); });
    document.getElementById("calendar-editor").addEventListener("submit", saveEvent);
    ["calendar-editor-close", "calendar-editor-cancel"].forEach(function (id) { document.getElementById(id).addEventListener("click", closeEditor); });
    document.querySelector('[data-calendar-close="true"]').addEventListener("click", closeEditor);
    document.getElementById("calendar-detail-close").addEventListener("click", function () { setModalVisibility(document.getElementById("calendar-detail-modal"), false); });
    document.querySelector('[data-calendar-detail-close="true"]').addEventListener("click", function () { setModalVisibility(document.getElementById("calendar-detail-modal"), false); });
    document.getElementById("calendar-detail-edit").addEventListener("click", function () { const event = state.events.find(function (item) { return item.id === state.detailId; }); setModalVisibility(document.getElementById("calendar-detail-modal"), false); if (event) openEditor(event); });
    document.getElementById("calendar-detail-delete").addEventListener("click", deleteEvent);
    document.addEventListener("click", function (event) {
      const eventButton = event.target.closest("[data-calendar-event]");
      if (eventButton) { event.stopPropagation(); openDetail(eventButton.dataset.calendarEvent); return; }
      const dateButton = event.target.closest("[data-calendar-new-date]");
      if (dateButton && isManager()) openEditor(null, dateButton.dataset.calendarNewDate);
    });
  }

  async function init(session) {
    state.session = session;
    document.getElementById("calendar-new").hidden = !isManager();
    setFeedback(document.getElementById("calendar-feedback"), "Carregando calendário...");
    try {
      const results = await Promise.all([
        window.AgendaGamaDataStore.list("calendarEvents", []),
        window.AgendaGamaDataStore.list("turmas", [])
      ]);
      state.events = results[0] || [];
      state.turmas = results[1] || [];
      renderTurmaOptions();
      bindEvents();
      render();
      setFeedback(document.getElementById("calendar-feedback"), "");
      const requestedEvent = new URLSearchParams(window.location.search).get("event");
      if (requestedEvent) openDetail(requestedEvent);
    } catch (error) {
      setFeedback(document.getElementById("calendar-feedback"), error?.message || "Não foi possível carregar o calendário.", "error");
    }
  }

  function mount() {
    const start = function (session) { if (session && window.AgendaGamaDataStore) init(session); };
    if (document.getElementById("calendar-grid")) start(window.AgendaGamaAuth?.getSession?.());
    else window.addEventListener("agenda-shell-ready", function (event) { start(event.detail?.session || window.AgendaGamaAuth?.getSession?.()); }, { once: true });
  }

  window.AgendaGamaSchoolCalendar = { mount: mount };
})();
