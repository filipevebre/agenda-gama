(function () {
  const STORAGE_KEY = "agenda-gama-notices";
  const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const PAGE_MODE = document.body?.dataset.page === "comunicados-arquivados" ? "archived" : "active";

  const NOTICE_SEED = [
    {
      id: "notice-seed-1",
      title: "Reuniao geral com familias na proxima semana",
      summary: "Encontro presencial para alinhamentos pedagogicos e organizacionais do bimestre.",
      body: "A reuniao geral com as familias acontecera na quarta-feira, as 18h30, no auditorio principal. Pedimos pontualidade para apresentacao do calendario, combinados da rotina escolar e espaco para perguntas.",
      audience: "responsaveis",
      targetTurmas: [],
      archiveDate: "",
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
      targetTurmas: ["5o Ano B"],
      archiveDate: "2026-05-15",
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
      targetTurmas: [],
      archiveDate: "2026-04-29",
      pinned: false,
      urgent: false,
      authorName: "Direcao",
      authorRole: "administrador",
      createdAt: "2026-04-29T08:00:00.000Z"
    }
  ];

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizeTurmaLabel(value) {
    return normalizeText(value)
      .replace(/\u00aa/g, "a")
      .replace(/\u00ba/g, "o");
  }

  function turmaMatches(left, right) {
    return normalizeTurmaLabel(left) === normalizeTurmaLabel(right);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getTodayDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeArchiveDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
  }

  function formatArchiveDate(value) {
    const normalized = normalizeArchiveDate(value);
    if (!normalized) return "";
    return formatDate(`${normalized}T00:00:00`);
  }

  function isNoticeArchived(notice) {
    const archiveDate = normalizeArchiveDate(notice?.archiveDate);
    if (!archiveDate) return false;
    return archiveDate <= getTodayDateKey();
  }

  function normalizeNotice(item) {
    return {
      ...item,
      id: item.id || generateId(),
      audience: item.audience || "all",
      targetTurmas: Array.isArray(item.targetTurmas)
        ? item.targetTurmas.filter(Boolean)
        : item.targetTurmas
          ? [item.targetTurmas].filter(Boolean)
          : [],
      archiveDate: normalizeArchiveDate(item.archiveDate),
      pinned: Boolean(item.pinned),
      urgent: Boolean(item.urgent),
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function readNotices() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = NOTICE_SEED.map(normalizeNotice);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    try {
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeNotice) : NOTICE_SEED.map(normalizeNotice);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      const fallback = NOTICE_SEED.map(normalizeNotice);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  }

  function writeNotices(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizeNotice)));
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

  function formatDate(value) {
    try {
      return DATE_FORMATTER.format(new Date(value));
    } catch (error) {
      return value || "";
    }
  }

  function buildSessionContext(session, directory) {
    const alunos = directory.alunos || [];
    const responsaveis = directory.responsaveis || [];
    const professores = directory.professores || [];

    const professor = professores.find(function (item) {
      return normalizeText(item.email) === normalizeText(session?.email) || normalizeText(item.nome) === normalizeText(session?.name);
    }) || null;

    const responsavelRecords = responsaveis.filter(function (item) {
      return normalizeText(item.email) === normalizeText(session?.email);
    });

    const responsavelTurmas = new Set();
    responsavelRecords.forEach(function (record) {
      const aluno = record.aluno_id
        ? alunos.find(function (item) { return item.id === record.aluno_id; }) || null
        : alunos.find(function (item) { return normalizeText(item.nome) === normalizeText(record.aluno); }) || null;
      if (aluno?.turma) {
        responsavelTurmas.add(aluno.turma);
      }
    });

    const professorTurmas = new Set();
    if (professor?.turmas) {
      String(professor.turmas)
        .split(",")
        .map(function (item) { return item.trim(); })
        .filter(Boolean)
        .forEach(function (item) {
          professorTurmas.add(item);
        });
    } else if (professor?.turno) {
      (directory.turmas || []).forEach(function (turma) {
        if (normalizeText(turma.turno) === normalizeText(professor.turno)) {
          professorTurmas.add(turma.nome);
        }
      });
    }

    return {
      responsavelTurmas: responsavelTurmas,
      professorTurmas: professorTurmas
    };
  }

  function getVisibleTurmasForSession(session, context, directory) {
    if (session?.role === "administrador" || session?.role === "funcionarios") {
      return directory.turmas || [];
    }

    if (session?.role === "professores") {
      return (directory.turmas || []).filter(function (turma) {
        return Array.from(context.professorTurmas).some(function (name) {
          return turmaMatches(name, turma.nome);
        });
      });
    }

    if (session?.role === "responsaveis") {
      return (directory.turmas || []).filter(function (turma) {
        return Array.from(context.responsavelTurmas).some(function (name) {
          return turmaMatches(name, turma.nome);
        });
      });
    }

    return directory.turmas || [];
  }

  function noticeMatchesAudience(notice, session) {
    if (!notice) return false;
    if (session?.role === "administrador" || session?.role === "funcionarios") return true;
    if (notice.audience === "all") return true;
    if (session?.role === "responsaveis") return notice.audience === "responsaveis";
    if (session?.role === "professores") return notice.audience === "professores";
    return false;
  }

  function noticeMatchesTurmas(notice, session, context) {
    const targetTurmas = Array.isArray(notice?.targetTurmas) ? notice.targetTurmas.filter(Boolean) : [];
    if (!targetTurmas.length) return true;
    if (session?.role === "administrador" || session?.role === "funcionarios") return true;

    const sessionTurmas = session?.role === "professores"
      ? Array.from(context.professorTurmas)
      : session?.role === "responsaveis"
        ? Array.from(context.responsavelTurmas)
        : [];

    return targetTurmas.some(function (targetTurma) {
      return sessionTurmas.some(function (sessionTurma) {
        return turmaMatches(targetTurma, sessionTurma);
      });
    });
  }

  function isVisibleToSession(notice, session, context) {
    return noticeMatchesAudience(notice, session) && noticeMatchesTurmas(notice, session, context);
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

  function filterNotices(items, state, session, context) {
    return sortNotices(items).filter(function (notice) {
      if (!isVisibleToSession(notice, session, context)) {
        return false;
      }

      if (PAGE_MODE === "active" && isNoticeArchived(notice)) {
        return false;
      }

      if (PAGE_MODE === "archived" && !isNoticeArchived(notice)) {
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

      if (state.turmaFilter !== "all") {
        const targetTurmas = Array.isArray(notice.targetTurmas) ? notice.targetTurmas : [];
        if (!targetTurmas.some(function (turma) { return turmaMatches(turma, state.turmaFilter); })) {
          return false;
        }
      }

      const query = normalizeText(state.searchTerm);
      if (!query) {
        return true;
      }

      const haystack = [
        notice.title,
        notice.summary,
        notice.body,
        notice.authorName,
        getAudienceLabel(notice.audience),
        ...(notice.targetTurmas || []),
        notice.archiveDate
      ].map(normalizeText).join(" ");

      return haystack.includes(query);
    });
  }

  function buildTurmaSummary(targetTurmas) {
    const list = (targetTurmas || []).filter(Boolean);
    if (!list.length) {
      return "Todas as turmas";
    }

    if (list.length === 1) {
      return list[0];
    }

    if (list.length === 2) {
      return `${list[0]} e ${list[1]}`;
    }

    return `${list[0]}, ${list[1]} e mais ${list.length - 2}`;
  }

  function renderStats(items, refs) {
    const todayKey = getTodayDateKey();
    refs.statTotal.textContent = String(items.length);
    if (PAGE_MODE === "archived") {
      refs.statPinned.textContent = String(items.filter(function (item) { return item.urgent; }).length);
      refs.statUrgent.textContent = String(items.filter(function (item) { return (item.targetTurmas || []).length > 0; }).length);
      refs.statToday.textContent = String(items.filter(function (item) {
        return normalizeArchiveDate(item.archiveDate) === todayKey;
      }).length);
      return;
    }

    refs.statPinned.textContent = String(items.filter(function (item) { return item.pinned; }).length);
    refs.statUrgent.textContent = String(items.filter(function (item) { return item.urgent; }).length);
    refs.statToday.textContent = String(items.filter(function (item) {
      return new Date(item.createdAt || 0).toDateString() === new Date().toDateString();
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
          <small>${escapeHtml(getAudienceLabel(notice.audience))} - ${escapeHtml(buildTurmaSummary(notice.targetTurmas))}</small>
        </article>
      `;
    }).join("");
  }

  function buildNoticeCard(notice, session) {
    let actions = "";
    if (canManage(session) && PAGE_MODE === "active") {
      actions = `
        <div class="notice-card-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-notice-edit-id="${escapeHtml(notice.id)}">Editar</button>
          <button type="button" class="btn btn-secondary btn-sm" data-notice-remove-id="${escapeHtml(notice.id)}">Excluir</button>
        </div>
      `;
    }

    if (canManage(session) && PAGE_MODE === "archived") {
      actions = `
        <div class="notice-card-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-notice-restore-id="${escapeHtml(notice.id)}">Restaurar</button>
          <button type="button" class="btn btn-secondary btn-sm" data-notice-remove-id="${escapeHtml(notice.id)}">Excluir</button>
        </div>
      `;
    }

    const targetTurmas = Array.isArray(notice.targetTurmas) ? notice.targetTurmas : [];
    const archiveLabel = normalizeArchiveDate(notice.archiveDate)
      ? (PAGE_MODE === "archived" ? "Arquivado em" : "Arquivar em")
      : "";

    return `
      <article class="notice-card ${notice.pinned ? "pinned" : ""} ${notice.urgent ? "urgent" : ""}">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(notice.title)}</h3>
            <p class="notice-card-meta">${escapeHtml(notice.authorName || "Equipe escolar")} - ${escapeHtml(formatDate(notice.createdAt))}</p>
          </div>
          <div class="inline-tags">
            <span class="tag">${escapeHtml(getAudienceLabel(notice.audience))}</span>
            <span class="tag notice-tag-turma">${escapeHtml(buildTurmaSummary(targetTurmas))}</span>
            ${archiveLabel ? `<span class="tag notice-tag-archive">${escapeHtml(`${archiveLabel} ${formatArchiveDate(notice.archiveDate)}`)}</span>` : ""}
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

  async function loadDirectory() {
    const [turmas, alunos, responsaveis, professores] = await Promise.all([
      window.AgendaGamaDataStore.list("turmas", []),
      window.AgendaGamaDataStore.list("alunos", []),
      window.AgendaGamaDataStore.list("responsaveis", []),
      window.AgendaGamaDataStore.list("professores", [])
    ]);

    return {
      turmas: turmas || [],
      alunos: alunos || [],
      responsaveis: responsaveis || [],
      professores: professores || []
    };
  }

  function mountComunicados() {
    async function init(session) {
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
        archiveDate: document.getElementById("notice-archive-date"),
        pinned: document.getElementById("notice-pinned"),
        urgent: document.getElementById("notice-urgent"),
        turmaTargetList: document.getElementById("notice-turma-target-list"),
        turmaTargetSummary: document.getElementById("notice-turma-target-summary"),
        turmaTargetEmpty: document.getElementById("notice-turma-target-empty"),
        turmaTargetSelectAll: document.getElementById("notice-turma-select-all"),
        turmaTargetClear: document.getElementById("notice-turma-clear"),
        search: document.getElementById("notice-search"),
        audienceFilter: document.getElementById("notice-audience-filter"),
        priorityFilter: document.getElementById("notice-priority-filter"),
        turmaFilter: document.getElementById("notice-turma-filter"),
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

      const directory = await loadDirectory();
      const context = buildSessionContext(session, directory);

      const state = {
        notices: readNotices(),
        editingId: null,
        searchTerm: "",
        audienceFilter: "all",
        priorityFilter: "all",
        turmaFilter: "all",
        selectedTargetTurmas: []
      };

      function populateTurmaFilterOptions() {
        const visibleTurmas = getVisibleTurmasForSession(session, context, directory);
        refs.turmaFilter.innerHTML = ['<option value="all">Todas as turmas</option>'].concat(visibleTurmas.map(function (turma) {
          return `<option value="${escapeHtml(turma.nome)}">${escapeHtml(turma.nome)}</option>`;
        })).join("");
      }

      function renderTurmaTargetSelection() {
        if (!refs.turmaTargetList || !refs.turmaTargetEmpty || !refs.turmaTargetSummary) {
          return;
        }

        const allTurmas = directory.turmas || [];
        refs.turmaTargetEmpty.hidden = allTurmas.length > 0;
        refs.turmaTargetList.innerHTML = allTurmas.map(function (turma) {
          const checked = state.selectedTargetTurmas.some(function (selected) {
            return turmaMatches(selected, turma.nome);
          });

          return `
            <label class="student-selection-item notice-turma-item">
              <input type="checkbox" data-notice-turma-value="${escapeHtml(turma.nome)}" ${checked ? "checked" : ""}>
              <div>
                <strong>${escapeHtml(turma.nome)}</strong>
                <p>${escapeHtml(turma.turno || "Turno nao informado")} - ${escapeHtml(turma.ano || "Ano letivo")}</p>
              </div>
            </label>
          `;
        }).join("");

        refs.turmaTargetSummary.textContent = state.selectedTargetTurmas.length
          ? `Comunicado visivel para: ${buildTurmaSummary(state.selectedTargetTurmas)}.`
          : "Sem selecao de turma: o comunicado aparece para todos os vinculos do publico escolhido.";
      }

      function resetFeedback() {
        if (!refs.feedback) return;
        refs.feedback.textContent = "";
        refs.feedback.className = "feedback";
      }

      function closeEditor() {
        state.editingId = null;
        state.selectedTargetTurmas = [];
        refs.form?.reset();
        if (refs.editorTitle) {
          refs.editorTitle.textContent = "Novo comunicado";
        }
        resetFeedback();
        renderTurmaTargetSelection();
        if (canManage(session) && refs.editorPanel && refs.guidePanel) {
          refs.editorPanel.hidden = true;
          refs.guidePanel.hidden = false;
        }
      }

      function openEditor(notice) {
        if (!canManage(session) || PAGE_MODE === "archived") return;
        if (!refs.editorPanel || !refs.guidePanel) return;

        refs.editorPanel.hidden = false;
        refs.guidePanel.hidden = true;
        resetFeedback();
        state.editingId = notice?.id || null;
        state.selectedTargetTurmas = Array.isArray(notice?.targetTurmas) ? [...notice.targetTurmas] : [];
        refs.editorTitle.textContent = notice ? "Editar comunicado" : "Novo comunicado";
        refs.title.value = notice?.title || "";
        refs.audience.value = notice?.audience || "all";
        refs.summary.value = notice?.summary || "";
        refs.body.value = notice?.body || "";
        if (refs.archiveDate) {
          refs.archiveDate.value = normalizeArchiveDate(notice?.archiveDate);
        }
        refs.pinned.checked = Boolean(notice?.pinned);
        refs.urgent.checked = Boolean(notice?.urgent);
        renderTurmaTargetSelection();
        window.requestAnimationFrame(function () {
          refs.title?.focus();
        });
      }

      function render() {
        const filtered = filterNotices(state.notices, state, session, context);
        refs.empty.hidden = filtered.length > 0;
        refs.list.innerHTML = filtered.map(function (notice) {
          return buildNoticeCard(notice, session);
        }).join("");

        renderStats(filtered, refs);
        renderHighlights(filterNotices(state.notices, {
          searchTerm: "",
          audienceFilter: "all",
          priorityFilter: "all",
          turmaFilter: "all"
        }, session, context), refs);
      }

      if (!canManage(session) || PAGE_MODE === "archived") {
        refs.openEditor?.setAttribute("hidden", "hidden");
        if (refs.editorPanel) {
          refs.editorPanel.hidden = true;
        }
      }

      populateTurmaFilterOptions();
      renderTurmaTargetSelection();

      refs.openEditor?.addEventListener("click", function () {
        openEditor(null);
      });

      refs.cancel?.addEventListener("click", function () {
        closeEditor();
      });

      refs.turmaTargetSelectAll?.addEventListener("click", function () {
        state.selectedTargetTurmas = (directory.turmas || []).map(function (turma) { return turma.nome; });
        renderTurmaTargetSelection();
      });

      refs.turmaTargetClear?.addEventListener("click", function () {
        state.selectedTargetTurmas = [];
        renderTurmaTargetSelection();
      });

      refs.turmaTargetList?.addEventListener("change", function (event) {
        const checkbox = event.target.closest("[data-notice-turma-value]");
        if (!checkbox) return;

        const turmaName = checkbox.dataset.noticeTurmaValue;
        if (checkbox.checked) {
          state.selectedTargetTurmas = [...new Set(state.selectedTargetTurmas.concat(turmaName))];
        } else {
          state.selectedTargetTurmas = state.selectedTargetTurmas.filter(function (item) {
            return !turmaMatches(item, turmaName);
          });
        }
        renderTurmaTargetSelection();
      });

      refs.form?.addEventListener("submit", function (event) {
        event.preventDefault();

        const nextNotice = normalizeNotice({
          id: state.editingId || generateId(),
          title: String(refs.title.value || "").trim(),
          audience: String(refs.audience.value || "all"),
          summary: String(refs.summary.value || "").trim(),
          body: String(refs.body.value || "").trim(),
          targetTurmas: [...state.selectedTargetTurmas],
          archiveDate: refs.archiveDate?.value || "",
          pinned: Boolean(refs.pinned.checked),
          urgent: Boolean(refs.urgent.checked),
          authorName: session.name,
          authorRole: session.role,
          createdAt: state.editingId
            ? (state.notices.find(function (item) { return item.id === state.editingId; })?.createdAt || new Date().toISOString())
            : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

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
        if (refs.editorTitle) {
          refs.editorTitle.textContent = "Editar comunicado";
        }
      });

      refs.list?.addEventListener("click", function (event) {
        const editButton = event.target.closest("[data-notice-edit-id]");
        if (editButton) {
          const notice = state.notices.find(function (item) { return item.id === editButton.dataset.noticeEditId; }) || null;
          openEditor(notice);
          return;
        }

        const restoreButton = event.target.closest("[data-notice-restore-id]");
        if (restoreButton) {
          const noticeIndex = state.notices.findIndex(function (item) { return item.id === restoreButton.dataset.noticeRestoreId; });
          if (noticeIndex >= 0) {
            state.notices[noticeIndex] = normalizeNotice({
              ...state.notices[noticeIndex],
              archiveDate: ""
            });
            writeNotices(state.notices);
            render();
          }
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

      refs.turmaFilter?.addEventListener("change", function () {
        state.turmaFilter = refs.turmaFilter.value;
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
