(function () {
  const STORAGE_KEY = "agenda-gama-notices";
  const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  const NOTICE_SEED = [
    {
      id: "notice-seed-1",
      title: "Reuniao geral com familias na proxima semana",
      summary: "Encontro presencial para alinhamentos pedagogicos e organizacionais do bimestre.",
      body: "A reuniao geral com as familias acontecera na quarta-feira, as 18h30, no auditorio principal. Pedimos pontualidade para apresentacao do calendario, combinados da rotina escolar e espaco para perguntas.",
      audience: "responsaveis",
      pinned: true,
      urgent: false,
      authorName: "Secretaria Escolar",
      authorRole: "funcionarios",
      createdAt: "2026-04-27T13:00:00.000Z"
    },
    {
      id: "notice-seed-2",
      title: "Atualizacao do calendario de provas",
      summary: "Professores e equipe devem revisar o cronograma ajustado para maio.",
      body: "O calendario de provas do mes de maio foi atualizado com pequenos ajustes de horario em duas turmas do Ensino Fundamental. Conferir o cronograma completo antes de registrar novos avisos em agenda.",
      audience: "professores",
      pinned: false,
      urgent: true,
      authorName: "Coordenacao Pedagogica",
      authorRole: "funcionarios",
      createdAt: "2026-04-28T09:15:00.000Z"
    },
    {
      id: "notice-seed-3",
      title: "Expediente interno na sexta-feira",
      summary: "Atendimento administrativo com horario reduzido para organizacao interna.",
      body: "Na sexta-feira, o atendimento interno da equipe administrativa sera encerrado as 15h para fechamento mensal. Pendencias urgentes devem ser registradas ate as 13h.",
      audience: "funcionarios",
      pinned: false,
      urgent: false,
      authorName: "Direcao",
      authorRole: "administrador",
      createdAt: "2026-04-29T08:00:00.000Z"
    }
  ];

  function readNotices() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(NOTICE_SEED));
      return [...NOTICE_SEED];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [...NOTICE_SEED];
    } catch (error) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(NOTICE_SEED));
      return [...NOTICE_SEED];
    }
  }

  function writeNotices(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function canManage(session) {
    return session?.role === "administrador" || session?.role === "funcionarios";
  }

  function getAudienceLabel(audience) {
    const labels = {
      all: "Toda a escola",
      responsaveis: "Responsaveis",
      professores: "Professores",
      funcionarios: "Equipe interna"
    };

    return labels[audience] || "Toda a escola";
  }

  function isVisibleToSession(notice, session) {
    if (!notice) return false;
    if (session?.role === "administrador" || session?.role === "funcionarios") return true;
    if (notice.audience === "all") return true;
    if (session?.role === "responsaveis") return notice.audience === "responsaveis";
    if (session?.role === "professores") return notice.audience === "professores";
    return false;
  }

  function sortNotices(items) {
    return [...items].sort(function (left, right) {
      if (Boolean(left.pinned) !== Boolean(right.pinned)) {
        return left.pinned ? -1 : 1;
      }

      if (Boolean(left.urgent) !== Boolean(right.urgent)) {
        return left.urgent ? -1 : 1;
      }

      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }

  function filterNotices(items, state, session) {
    return sortNotices(items).filter(function (notice) {
      if (!isVisibleToSession(notice, session)) {
        return false;
      }

      if (state.audienceFilter !== "all" && notice.audience !== state.audienceFilter) {
        return false;
      }

      if (state.priorityFilter === "pinned" && !notice.pinned) {
        return false;
      }

      if (state.priorityFilter === "urgent" && !notice.urgent) {
        return false;
      }

      if (state.priorityFilter === "recent") {
        const age = Date.now() - new Date(notice.createdAt || 0).getTime();
        if (age > 1000 * 60 * 60 * 24 * 7) {
          return false;
        }
      }

      const query = normalizeText(state.searchTerm);
      if (!query) {
        return true;
      }

      const haystack = [notice.title, notice.summary, notice.body, notice.authorName, getAudienceLabel(notice.audience)]
        .map(normalizeText)
        .join(" ");

      return haystack.includes(query);
    });
  }

  function formatDate(value) {
    try {
      return DATE_FORMATTER.format(new Date(value));
    } catch (error) {
      return value || "";
    }
  }

  function renderStats(items, refs) {
    const todayKey = new Date().toDateString();
    refs.statTotal.textContent = String(items.length);
    refs.statPinned.textContent = String(items.filter(function (item) { return item.pinned; }).length);
    refs.statUrgent.textContent = String(items.filter(function (item) { return item.urgent; }).length);
    refs.statToday.textContent = String(items.filter(function (item) {
      return new Date(item.createdAt || 0).toDateString() === todayKey;
    }).length);
  }

  function renderHighlights(items, refs) {
    const highlightItems = items.filter(function (item) { return item.pinned || item.urgent; }).slice(0, 4);
    refs.highlightEmpty.hidden = highlightItems.length > 0;
    refs.highlightList.innerHTML = highlightItems.map(function (notice) {
      return `
        <article class="notice-highlight-card">
          <div class="card-head">
            <strong class="card-title">${escapeHtml(notice.title)}</strong>
            <div class="inline-tags">
              ${notice.pinned ? '<span class="tag">Fixado</span>' : ""}
              ${notice.urgent ? '<span class="tag notice-tag-urgent">Urgente</span>' : ""}
            </div>
          </div>
          <p>${escapeHtml(notice.summary)}</p>
          <small>${escapeHtml(getAudienceLabel(notice.audience))} - ${escapeHtml(formatDate(notice.createdAt))}</small>
        </article>
      `;
    }).join("");
  }

  function buildNoticeCard(notice, session) {
    const actions = canManage(session) ? `
      <div class="notice-card-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-notice-edit-id="${escapeHtml(notice.id)}">Editar</button>
        <button type="button" class="btn btn-secondary btn-sm" data-notice-remove-id="${escapeHtml(notice.id)}">Excluir</button>
      </div>
    ` : "";

    return `
      <article class="notice-card ${notice.pinned ? "pinned" : ""} ${notice.urgent ? "urgent" : ""}">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(notice.title)}</h3>
            <p class="notice-card-meta">${escapeHtml(notice.authorName || "Equipe escolar")} - ${escapeHtml(formatDate(notice.createdAt))}</p>
          </div>
          <div class="inline-tags">
            <span class="tag">${escapeHtml(getAudienceLabel(notice.audience))}</span>
            ${notice.pinned ? '<span class="tag">Fixado</span>' : ""}
            ${notice.urgent ? '<span class="tag notice-tag-urgent">Urgente</span>' : ""}
          </div>
        </div>
        <p class="notice-card-summary">${escapeHtml(notice.summary)}</p>
        <div class="divider"></div>
        <p class="notice-card-body">${escapeHtml(notice.body)}</p>
        ${actions}
      </article>
    `;
  }

  function mountComunicados() {
    function init(session) {
      const refs = {
        openEditor: document.getElementById("notice-open-editor"),
        editorPanel: document.getElementById("notice-editor-panel"),
        guidePanel: document.getElementById("notice-guide-panel"),
        editorTitle: document.getElementById("notice-editor-title"),
        form: document.getElementById("notice-form"),
        cancel: document.getElementById("notice-cancel"),
        feedback: document.getElementById("notice-form-feedback"),
        title: document.getElementById("notice-title"),
        audience: document.getElementById("notice-audience"),
        summary: document.getElementById("notice-summary"),
        body: document.getElementById("notice-body"),
        pinned: document.getElementById("notice-pinned"),
        urgent: document.getElementById("notice-urgent"),
        search: document.getElementById("notice-search"),
        audienceFilter: document.getElementById("notice-audience-filter"),
        priorityFilter: document.getElementById("notice-priority-filter"),
        list: document.getElementById("notice-list"),
        empty: document.getElementById("notice-empty"),
        highlightList: document.getElementById("notice-highlight-list"),
        highlightEmpty: document.getElementById("notice-highlight-empty"),
        statTotal: document.getElementById("notice-stat-total"),
        statPinned: document.getElementById("notice-stat-pinned"),
        statUrgent: document.getElementById("notice-stat-urgent"),
        statToday: document.getElementById("notice-stat-today")
      };

      if (!refs.list) return;

      const state = {
        notices: readNotices(),
        editingId: null,
        searchTerm: "",
        audienceFilter: "all",
        priorityFilter: "all"
      };

      if (!canManage(session)) {
        refs.openEditor?.setAttribute("hidden", "hidden");
        refs.editorPanel.hidden = true;
      }

      function resetFeedback() {
        refs.feedback.textContent = "";
        refs.feedback.className = "feedback";
      }

      function closeEditor() {
        state.editingId = null;
        refs.form?.reset();
        refs.editorTitle.textContent = "Novo comunicado";
        resetFeedback();
        if (canManage(session)) {
          refs.editorPanel.hidden = true;
          refs.guidePanel.hidden = false;
        }
      }

      function openEditor(notice) {
        if (!canManage(session)) return;
        refs.editorPanel.hidden = false;
        refs.guidePanel.hidden = true;
        resetFeedback();
        state.editingId = notice?.id || null;
        refs.editorTitle.textContent = notice ? "Editar comunicado" : "Novo comunicado";
        refs.title.value = notice?.title || "";
        refs.audience.value = notice?.audience || "all";
        refs.summary.value = notice?.summary || "";
        refs.body.value = notice?.body || "";
        refs.pinned.checked = Boolean(notice?.pinned);
        refs.urgent.checked = Boolean(notice?.urgent);
        window.requestAnimationFrame(function () {
          refs.title?.focus();
        });
      }

      function render() {
        const filtered = filterNotices(state.notices, state, session);
        refs.empty.hidden = filtered.length > 0;
        refs.list.innerHTML = filtered.map(function (notice) {
          return buildNoticeCard(notice, session);
        }).join("");

        renderStats(filtered, refs);
        renderHighlights(filterNotices(state.notices, {
          searchTerm: "",
          audienceFilter: "all",
          priorityFilter: "all"
        }, session), refs);
      }

      refs.openEditor?.addEventListener("click", function () {
        openEditor(null);
      });

      refs.cancel?.addEventListener("click", function () {
        closeEditor();
      });

      refs.form?.addEventListener("submit", function (event) {
        event.preventDefault();

        const nextNotice = {
          id: state.editingId || generateId(),
          title: String(refs.title.value || "").trim(),
          audience: String(refs.audience.value || "all"),
          summary: String(refs.summary.value || "").trim(),
          body: String(refs.body.value || "").trim(),
          pinned: Boolean(refs.pinned.checked),
          urgent: Boolean(refs.urgent.checked),
          authorName: session.name,
          authorRole: session.role,
          createdAt: state.editingId
            ? (state.notices.find(function (item) { return item.id === state.editingId; })?.createdAt || new Date().toISOString())
            : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (!nextNotice.title || !nextNotice.summary || !nextNotice.body) {
          refs.feedback.textContent = "Preencha titulo, resumo e conteudo para continuar.";
          refs.feedback.className = "feedback error";
          return;
        }

        const existingIndex = state.notices.findIndex(function (item) { return item.id === nextNotice.id; });
        if (existingIndex >= 0) {
          state.notices[existingIndex] = nextNotice;
        } else {
          state.notices.unshift(nextNotice);
        }

        writeNotices(state.notices);
        render();
        refs.feedback.textContent = state.editingId ? "Comunicado atualizado com sucesso." : "Comunicado publicado com sucesso.";
        refs.feedback.className = "feedback success";
        state.editingId = nextNotice.id;
        refs.editorTitle.textContent = "Editar comunicado";
      });

      refs.list?.addEventListener("click", function (event) {
        const editButton = event.target.closest("[data-notice-edit-id]");
        if (editButton) {
          const notice = state.notices.find(function (item) { return item.id === editButton.dataset.noticeEditId; }) || null;
          openEditor(notice);
          return;
        }

        const removeButton = event.target.closest("[data-notice-remove-id]");
        if (!removeButton) return;

        state.notices = state.notices.filter(function (item) { return item.id !== removeButton.dataset.noticeRemoveId; });
        writeNotices(state.notices);
        if (state.editingId === removeButton.dataset.noticeRemoveId) {
          closeEditor();
        }
        render();
      });

      refs.search?.addEventListener("input", function () {
        state.searchTerm = refs.search.value;
        render();
      });

      refs.audienceFilter?.addEventListener("change", function () {
        state.audienceFilter = refs.audienceFilter.value;
        render();
      });

      refs.priorityFilter?.addEventListener("change", function () {
        state.priorityFilter = refs.priorityFilter.value;
        render();
      });

      window.addEventListener("storage", function (event) {
        if (event.key !== STORAGE_KEY) return;
        state.notices = readNotices();
        render();
      });

      render();
    }

    if (document.getElementById("notice-list")) {
      init(window.AgendaGamaAuth?.getSession?.() || null);
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady(event) {
      window.removeEventListener("agenda-shell-ready", handleReady);
      init(event.detail?.session || null);
    });
  }

  window.AgendaGamaComunicados = {
    mountComunicados
  };
})();
