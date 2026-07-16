(function () {
  const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

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

  function turmaMatches(left, right) {
    return normalizeText(left).replace(/\u00aa/g, "a").replace(/\u00ba/g, "o")
      === normalizeText(right).replace(/\u00aa/g, "a").replace(/\u00ba/g, "o");
  }

  function formatDate(value) {
    if (!value) return "Sem prazo";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Sem prazo" : DATE_FORMATTER.format(date);
  }

  function toLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function statusLabel(status) {
    return ({ draft: "Rascunho", published: "Publicada", closed: "Encerrada" })[status] || "Atividade";
  }

  function isLate(activity) {
    return Boolean(activity?.dueAt) && new Date(activity.dueAt).getTime() < Date.now();
  }

  function isManager(session) {
    return ["administrador", "funcionarios", "professores"].includes(session?.role);
  }

  function mountModalPortal(modal) {
    if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
  }

  function setModalOpen(modal, open) {
    if (!modal) return;
    modal.hidden = !open;
    const anyOpen = Array.from(document.querySelectorAll(".app-modal")).some(function (item) {
      return !item.hidden;
    });
    document.body.classList.toggle("app-modal-open", anyOpen);
  }

  function ensureShellContent(callback) {
    if (document.getElementById("activity-list")) {
      callback();
      return;
    }
    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("Não foi possível ler o arquivo.")); };
      reader.readAsDataURL(file);
    });
  }

  async function buildAttachment(file) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error(`${file.name} ultrapassa o limite de 2 MB.`);
    }
    return {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `file-${Date.now()}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      url: await readFileAsDataUrl(file)
    };
  }

  function fileSizeLabel(size) {
    const bytes = Number(size || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function mount() {
    async function init(session) {
      if (!session || !window.AgendaGamaDataStore) return;

      const refs = {
        pageTitle: document.getElementById("activity-page-title"),
        pageDescription: document.getElementById("activity-page-description"),
        newButton: document.getElementById("activity-new"),
        list: document.getElementById("activity-list"),
        empty: document.getElementById("activity-empty"),
        feedback: document.getElementById("activity-feedback"),
        search: document.getElementById("activity-search"),
        statusFilter: document.getElementById("activity-status-filter"),
        subjectFilter: document.getElementById("activity-subject-filter"),
        boardTitle: document.getElementById("activity-board-title"),
        boardCopy: document.getElementById("activity-board-copy"),
        statMainLabel: document.getElementById("activity-stat-main-label"),
        statMain: document.getElementById("activity-stat-main"),
        statSecondaryLabel: document.getElementById("activity-stat-secondary-label"),
        statSecondary: document.getElementById("activity-stat-secondary"),
        statPendingLabel: document.getElementById("activity-stat-pending-label"),
        statPending: document.getElementById("activity-stat-pending"),
        editorModal: document.getElementById("activity-editor-modal"),
        editor: document.getElementById("activity-editor"),
        editorTitle: document.getElementById("activity-editor-title"),
        editorClose: document.getElementById("activity-editor-close"),
        editorCancel: document.getElementById("activity-editor-cancel"),
        editorFeedback: document.getElementById("activity-editor-feedback"),
        title: document.getElementById("activity-title"),
        subject: document.getElementById("activity-subject"),
        subjectOptions: document.getElementById("activity-subject-options"),
        description: document.getElementById("activity-description"),
        dueAt: document.getElementById("activity-due-at"),
        attachmentInput: document.getElementById("activity-attachments"),
        attachmentList: document.getElementById("activity-attachment-list"),
        turmaList: document.getElementById("activity-turma-list"),
        turmaEmpty: document.getElementById("activity-turma-empty"),
        selectAllTurmas: document.getElementById("activity-select-all-turmas"),
        clearTurmas: document.getElementById("activity-clear-turmas"),
        detailModal: document.getElementById("activity-detail-modal"),
        detailClose: document.getElementById("activity-detail-close"),
        detailSubject: document.getElementById("activity-detail-subject"),
        detailTitle: document.getElementById("activity-detail-title"),
        detailMeta: document.getElementById("activity-detail-meta"),
        detailBody: document.getElementById("activity-detail-body"),
        detailAttachments: document.getElementById("activity-detail-attachments"),
        completionForm: document.getElementById("activity-completion-form"),
        completionStudent: document.getElementById("activity-completion-student"),
        completionSubmit: document.getElementById("activity-completion-submit"),
        completionFeedback: document.getElementById("activity-completion-feedback"),
        completionsModal: document.getElementById("activity-completions-modal"),
        completionsClose: document.getElementById("activity-completions-close"),
        completionsTitle: document.getElementById("activity-completions-title"),
        completionsSummary: document.getElementById("activity-completions-summary"),
        completionList: document.getElementById("activity-completion-list"),
        completionsEmpty: document.getElementById("activity-completions-empty")
      };

      [refs.editorModal, refs.detailModal, refs.completionsModal].forEach(mountModalPortal);

      const [activities, completions, turmas, alunos, responsaveis, professores, disciplinas] = await Promise.all([
        window.AgendaGamaDataStore.list("activities", []),
        window.AgendaGamaDataStore.list("activityCompletions", []),
        window.AgendaGamaDataStore.list("turmas", []),
        window.AgendaGamaDataStore.list("alunos", []),
        window.AgendaGamaDataStore.list("responsaveis", []),
        window.AgendaGamaDataStore.list("professores", []),
        window.AgendaGamaDataStore.list("disciplinas", [])
      ]).catch(function (error) {
        refs.feedback.textContent = `Não foi possível carregar as atividades: ${error.message}`;
        refs.feedback.className = "feedback error";
        return [[], [], [], [], [], [], []];
      });

      const state = {
        activities: activities || [],
        completions: completions || [],
        turmas: turmas || [],
        alunos: alunos || [],
        responsaveis: responsaveis || [],
        professores: professores || [],
        disciplinas: disciplinas || [],
        children: [],
        availableTurmas: [],
        editingId: null,
        activeId: null,
        pendingAttachments: []
      };

      function linkedChildren() {
        if (session.role !== "responsaveis") return [];
        const records = state.responsaveis.filter(function (item) {
          return String(item.auth_user_id || "") === String(session.userId || "")
            || normalizeText(item.email) === normalizeText(session.email);
        });
        return state.alunos.filter(function (student) {
          return records.some(function (record) {
            return String(record.aluno_id || "") === String(student.id || "")
              || normalizeText(record.aluno) === normalizeText(student.nome);
          });
        });
      }

      function teacherTurmaNames() {
        if (session.role !== "professores") return [];
        const professor = state.professores.find(function (item) {
          return String(item.auth_user_id || "") === String(session.userId || "")
            || normalizeText(item.email) === normalizeText(session.email)
            || normalizeText(item.nome).replace(/^(prof|profa|professor|professora)\.?\s+/, "")
              === normalizeText(session.name).replace(/^(prof|profa|professor|professora)\.?\s+/, "");
        });
        const names = String(professor?.turmas || "")
          .split(",")
          .map(function (item) { return item.split(" - ")[0].trim(); })
          .filter(Boolean);
        state.alunos.forEach(function (student) {
          if (names.some(function (name) { return turmaMatches(name, student.turma); })) return;
          const visibleActivity = state.activities.some(function (activity) {
            return activity.authorUserId === session.userId
              && activity.targetTurmas?.some(function (name) { return turmaMatches(name, student.turma); });
          });
          if (visibleActivity && student.turma) names.push(student.turma);
        });
        return names;
      }

      state.children = linkedChildren();
      const teacherNames = teacherTurmaNames();
      state.availableTurmas = session.role === "professores"
        ? state.turmas.filter(function (turma) { return teacherNames.some(function (name) { return turmaMatches(name, turma.nome); }); })
        : state.turmas;

      function eligibleChildren(activity) {
        const targets = activity.targetTurmas || [];
        return state.children.filter(function (student) {
          return targets.some(function (turma) { return turmaMatches(turma, student.turma); });
        });
      }

      function activityCompletions(activityId) {
        return state.completions.filter(function (item) { return String(item.activityId) === String(activityId); });
      }

      function completionFor(activityId, studentId) {
        return state.completions.find(function (item) {
          return String(item.activityId) === String(activityId) && String(item.studentId) === String(studentId);
        }) || null;
      }

      function canManage(activity) {
        if (["administrador", "funcionarios"].includes(session.role)) return true;
        return session.role === "professores" && String(activity?.authorUserId || "") === String(session.userId || "");
      }

      function setFeedback(message, type) {
        refs.feedback.textContent = message || "";
        refs.feedback.className = `feedback${type ? ` ${type}` : ""}`;
      }

      function renderSubjectOptions() {
        const names = new Set();
        state.disciplinas.forEach(function (item) { if (item.nome) names.add(item.nome); });
        state.activities.forEach(function (item) { if (item.subject) names.add(item.subject); });
        const sorted = Array.from(names).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
        refs.subjectOptions.innerHTML = sorted.map(function (name) { return `<option value="${escapeHtml(name)}"></option>`; }).join("");
        refs.subjectFilter.innerHTML = `<option value="all">Todas</option>${sorted.map(function (name) {
          return `<option value="${escapeHtml(normalizeText(name))}">${escapeHtml(name)}</option>`;
        }).join("")}`;
      }

      function renderStats() {
        if (session.role === "responsaveis") {
          const visible = state.activities.filter(function (activity) { return eligibleChildren(activity).length; });
          const completed = visible.filter(function (activity) {
            const children = eligibleChildren(activity);
            return children.length && children.every(function (child) { return completionFor(activity.id, child.id); });
          }).length;
          refs.statMainLabel.textContent = "Disponíveis";
          refs.statMain.textContent = visible.filter(function (item) { return item.status === "published"; }).length;
          refs.statSecondaryLabel.textContent = "Concluídas";
          refs.statSecondary.textContent = completed;
          refs.statPendingLabel.textContent = "Pendentes";
          refs.statPending.textContent = visible.filter(function (activity) {
            return activity.status === "published" && eligibleChildren(activity).some(function (child) {
              return !completionFor(activity.id, child.id);
            });
          }).length;
          return;
        }
        refs.statMain.textContent = state.activities.filter(function (item) { return item.status === "published"; }).length;
        refs.statSecondaryLabel.textContent = "Conclusões";
        refs.statSecondary.textContent = state.completions.length;
        refs.statPendingLabel.textContent = "Rascunhos";
        refs.statPending.textContent = state.activities.filter(function (item) { return item.status === "draft"; }).length;
      }

      function matchesFilters(activity) {
        const search = normalizeText(refs.search.value);
        const subject = refs.subjectFilter.value;
        const status = refs.statusFilter.value;
        if (search && !normalizeText(`${activity.title} ${activity.subject} ${activity.description}`).includes(search)) return false;
        if (subject !== "all" && normalizeText(activity.subject) !== subject) return false;
        if (session.role === "responsaveis") {
          const children = eligibleChildren(activity);
          const completed = children.length && children.every(function (child) { return completionFor(activity.id, child.id); });
          if (status === "pending" && (completed || activity.status !== "published")) return false;
          if (status === "completed" && !completed) return false;
          if (["published", "draft", "closed"].includes(status) && activity.status !== status) return false;
          return true;
        }
        return status === "all" || status === activity.status;
      }

      function managerCard(activity) {
        const completions = activityCompletions(activity.id);
        const manageable = canManage(activity);
        const targets = activity.targetTurmas?.join(", ") || "Sem turma";
        return `
          <article class="activity-card">
            <button class="activity-card-main" type="button" data-activity-view="${escapeHtml(activity.id)}">
              <span class="activity-subject-icon">${escapeHtml((activity.subject || "AT").slice(0, 2).toUpperCase())}</span>
              <span class="activity-card-copy">
                <span class="activity-card-head">
                  <strong>${escapeHtml(activity.title)}</strong>
                  <span class="status-badge activity-status-${escapeHtml(activity.status)}">${escapeHtml(statusLabel(activity.status))}</span>
                </span>
                <span class="activity-card-description">${escapeHtml(activity.description || "Sem orientações adicionais.")}</span>
                <span class="activity-card-meta">${escapeHtml(activity.subject || "Sem disciplina")} · ${escapeHtml(targets)} · ${escapeHtml(formatDate(activity.dueAt))}</span>
              </span>
              <span class="activity-card-arrow">›</span>
            </button>
            <div class="activity-card-footer">
              <span><strong>${completions.length}</strong> conclusão(ões)</span>
              <div class="activity-card-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-activity-completions="${escapeHtml(activity.id)}">Conclusões</button>
                ${manageable ? `<button class="btn btn-secondary btn-sm" type="button" data-activity-edit="${escapeHtml(activity.id)}">Editar</button>` : ""}
                ${manageable && activity.status === "draft" ? `<button class="btn btn-primary btn-sm" type="button" data-activity-status="published" data-activity-id="${escapeHtml(activity.id)}">Publicar</button>` : ""}
                ${manageable && activity.status === "published" ? `<button class="btn btn-secondary btn-sm" type="button" data-activity-status="closed" data-activity-id="${escapeHtml(activity.id)}">Encerrar</button>` : ""}
                ${manageable ? `<button class="btn btn-danger btn-sm" type="button" data-activity-delete="${escapeHtml(activity.id)}">Excluir</button>` : ""}
              </div>
            </div>
          </article>
        `;
      }

      function guardianCard(activity) {
        const children = eligibleChildren(activity);
        const completedCount = children.filter(function (child) { return completionFor(activity.id, child.id); }).length;
        const done = children.length > 0 && completedCount === children.length;
        const badge = done ? "Concluída" : activity.status === "closed" ? "Encerrada" : isLate(activity) ? "Atrasada" : "Pendente";
        const badgeClass = done ? "activity-status-completed" : activity.status === "closed" ? "activity-status-closed" : "activity-status-pending";
        return `
          <button class="activity-card activity-family-card" type="button" data-activity-view="${escapeHtml(activity.id)}">
            <span class="activity-subject-icon">${escapeHtml((activity.subject || "AT").slice(0, 2).toUpperCase())}</span>
            <span class="activity-card-copy">
              <span class="activity-card-head">
                <strong>${escapeHtml(activity.title)}</strong>
                <span class="status-badge ${badgeClass}">${badge}</span>
              </span>
              <span class="activity-card-description">${escapeHtml(activity.description || "Toque para ver as orientações.")}</span>
              <span class="activity-card-meta">${escapeHtml(activity.subject || "Atividade")} · ${children.map(function (child) { return child.nome; }).join(", ")} · ${escapeHtml(formatDate(activity.dueAt))}</span>
            </span>
            <span class="activity-card-arrow">›</span>
          </button>
        `;
      }

      function render() {
        renderStats();
        const visible = state.activities
          .filter(function (activity) { return session.role !== "responsaveis" || eligibleChildren(activity).length; })
          .filter(matchesFilters)
          .sort(function (left, right) {
            const leftDate = new Date(left.dueAt || left.createdAt || 0).getTime();
            const rightDate = new Date(right.dueAt || right.createdAt || 0).getTime();
            return rightDate - leftDate;
          });
        refs.list.innerHTML = visible.map(function (activity) {
          return session.role === "responsaveis" ? guardianCard(activity) : managerCard(activity);
        }).join("");
        refs.empty.hidden = Boolean(visible.length);
      }

      function renderTurmas(selected) {
        refs.turmaList.innerHTML = state.availableTurmas.map(function (turma) {
          const checked = selected.some(function (name) { return turmaMatches(name, turma.nome); });
          return `
            <label class="activity-target-option">
              <input type="checkbox" value="${escapeHtml(turma.nome)}" ${checked ? "checked" : ""}>
              <span><strong>${escapeHtml(turma.nome)}</strong><small>${escapeHtml(turma.turno || "")}</small></span>
            </label>
          `;
        }).join("");
        refs.turmaEmpty.hidden = Boolean(state.availableTurmas.length);
      }

      function renderPendingAttachments() {
        refs.attachmentList.hidden = state.pendingAttachments.length === 0;
        refs.attachmentList.innerHTML = state.pendingAttachments.map(function (file) {
          return `
            <div class="activity-attachment-chip">
              <span><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(fileSizeLabel(file.size))}</small></span>
              <button type="button" class="btn btn-secondary btn-sm" data-activity-remove-attachment="${escapeHtml(file.id)}" aria-label="Remover anexo">x</button>
            </div>
          `;
        }).join("");
      }

      function openEditor(activity) {
        state.editingId = activity?.id || null;
        state.pendingAttachments = (activity?.attachments || []).map(function (item) { return { ...item }; });
        refs.editorTitle.textContent = activity ? "Editar atividade" : "Nova atividade";
        refs.title.value = activity?.title || "";
        refs.subject.value = activity?.subject || "";
        refs.description.value = activity?.description || "";
        refs.dueAt.value = toLocalDateTime(activity?.dueAt);
        refs.editorFeedback.textContent = "";
        renderTurmas(activity?.targetTurmas || []);
        renderPendingAttachments();
        setModalOpen(refs.editorModal, true);
        setTimeout(function () { refs.title.focus(); }, 50);
      }

      function closeEditor() {
        setModalOpen(refs.editorModal, false);
        state.editingId = null;
        state.pendingAttachments = [];
      }

      function renderDetailAttachments(activity) {
        const attachments = activity.attachments || [];
        refs.detailAttachments.innerHTML = attachments.length ? `
          <div class="activity-detail-section">
            <h3>Anexos</h3>
            <div class="activity-download-list">
              ${attachments.map(function (file) {
                const image = String(file.type || "").startsWith("image/");
                return `
                  <a class="activity-download-card" href="${escapeHtml(file.url)}" download="${escapeHtml(file.name)}" target="_blank" rel="noopener">
                    ${image ? `<img src="${escapeHtml(file.url)}" alt="">` : `<span class="activity-file-icon">AR</span>`}
                    <span><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(fileSizeLabel(file.size))}</small></span>
                  </a>
                `;
              }).join("")}
            </div>
          </div>
        ` : "";
      }

      function syncCompletionButton(activity) {
        const student = state.children.find(function (item) { return String(item.id) === String(refs.completionStudent.value); });
        const completion = student ? completionFor(activity.id, student.id) : null;
        refs.completionSubmit.textContent = completion ? "Atividade concluída" : "Marcar como concluída";
        refs.completionSubmit.disabled = Boolean(completion) || activity.status !== "published";
      }

      function openDetail(activity) {
        state.activeId = activity.id;
        refs.detailSubject.textContent = activity.subject || "Atividade";
        refs.detailTitle.textContent = activity.title;
        refs.detailMeta.textContent = `${activity.authorName || "Equipe escolar"} · ${activity.targetTurmas?.join(", ") || "Sem turma"} · Prazo: ${formatDate(activity.dueAt)}`;
        refs.detailBody.innerHTML = `
          <div class="activity-detail-section">
            <h3>Orientações</h3>
            <p>${escapeHtml(activity.description || "Nenhuma orientação adicional.").replace(/\n/g, "<br>")}</p>
          </div>
        `;
        renderDetailAttachments(activity);
        const children = eligibleChildren(activity);
        refs.completionForm.hidden = session.role !== "responsaveis" || children.length === 0;
        refs.completionStudent.innerHTML = children.map(function (child) {
          return `<option value="${escapeHtml(child.id)}">${escapeHtml(child.nome)} · ${escapeHtml(child.turma || "Sem turma")}</option>`;
        }).join("");
        refs.completionFeedback.textContent = "";
        if (children.length) syncCompletionButton(activity);
        setModalOpen(refs.detailModal, true);
      }

      function openCompletions(activity) {
        const completions = activityCompletions(activity.id);
        refs.completionsTitle.textContent = activity.title;
        refs.completionsSummary.textContent = `${completions.length} aluno(s) marcado(s) como concluído(s).`;
        refs.completionList.innerHTML = completions.map(function (item) {
          return `
            <article class="activity-completion-card">
              <span class="activity-completion-avatar">${escapeHtml((item.studentName || "A").slice(0, 1).toUpperCase())}</span>
              <div><strong>${escapeHtml(item.studentName)}</strong><small>${escapeHtml(item.turma)} · ${escapeHtml(item.responsibleName || item.responsibleEmail)} · ${escapeHtml(formatDate(item.completedAt))}</small></div>
            </article>
          `;
        }).join("");
        refs.completionsEmpty.hidden = Boolean(completions.length);
        setModalOpen(refs.completionsModal, true);
      }

      refs.newButton.hidden = !isManager(session);
      if (session.role === "responsaveis") {
        refs.pageTitle.textContent = "Atividades da criança";
        refs.pageDescription.textContent = "Consulte tarefas, prazos e materiais enviados pelos professores.";
        refs.boardTitle.textContent = "Tarefas da escola";
        refs.boardCopy.textContent = "Toque em uma atividade para abrir as orientações.";
      }

      renderSubjectOptions();
      refs.newButton.addEventListener("click", function () { openEditor(null); });
      [refs.search, refs.statusFilter, refs.subjectFilter].forEach(function (field) {
        field.addEventListener(field.tagName === "INPUT" ? "input" : "change", render);
      });
      refs.editorClose.addEventListener("click", closeEditor);
      refs.editorCancel.addEventListener("click", closeEditor);
      refs.editorModal.querySelector("[data-activity-close-editor]").addEventListener("click", closeEditor);
      refs.detailClose.addEventListener("click", function () { setModalOpen(refs.detailModal, false); });
      refs.detailModal.querySelector("[data-activity-close-detail]").addEventListener("click", function () { setModalOpen(refs.detailModal, false); });
      refs.completionsClose.addEventListener("click", function () { setModalOpen(refs.completionsModal, false); });
      refs.completionsModal.querySelector("[data-activity-close-completions]").addEventListener("click", function () { setModalOpen(refs.completionsModal, false); });
      refs.selectAllTurmas.addEventListener("click", function () {
        refs.turmaList.querySelectorAll("input").forEach(function (input) { input.checked = true; });
      });
      refs.clearTurmas.addEventListener("click", function () {
        refs.turmaList.querySelectorAll("input").forEach(function (input) { input.checked = false; });
      });
      refs.attachmentList.addEventListener("click", function (event) {
        const id = event.target.closest("[data-activity-remove-attachment]")?.dataset.activityRemoveAttachment;
        if (!id) return;
        state.pendingAttachments = state.pendingAttachments.filter(function (item) { return item.id !== id; });
        renderPendingAttachments();
      });
      refs.attachmentInput.addEventListener("change", async function () {
        const files = Array.from(refs.attachmentInput.files || []);
        refs.attachmentInput.value = "";
        if (state.pendingAttachments.length + files.length > 3) {
          refs.editorFeedback.textContent = "Envie no máximo 3 anexos por atividade.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        try {
          for (const file of files) state.pendingAttachments.push(await buildAttachment(file));
          renderPendingAttachments();
          refs.editorFeedback.textContent = "Anexo adicionado.";
          refs.editorFeedback.className = "feedback success";
        } catch (error) {
          refs.editorFeedback.textContent = error.message || "Não foi possível anexar o arquivo.";
          refs.editorFeedback.className = "feedback error";
        }
      });
      refs.editor.addEventListener("submit", async function (event) {
        event.preventDefault();
        const submitter = event.submitter;
        const selectedTurmas = Array.from(refs.turmaList.querySelectorAll("input:checked")).map(function (input) { return input.value; });
        if (!selectedTurmas.length) {
          refs.editorFeedback.textContent = "Selecione pelo menos uma turma.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        const current = state.activities.find(function (item) { return item.id === state.editingId; });
        const payload = {
          ...current,
          id: current?.id || null,
          title: refs.title.value.trim(),
          subject: refs.subject.value.trim(),
          description: refs.description.value.trim(),
          status: submitter?.dataset.saveStatus || current?.status || "published",
          targetTurmas: selectedTurmas,
          attachments: state.pendingAttachments.map(function (item) { return { ...item }; }),
          dueAt: refs.dueAt.value ? new Date(refs.dueAt.value).toISOString() : "",
          authorUserId: current?.authorUserId || session.userId,
          authorName: current?.authorName || session.name,
          authorEmail: current?.authorEmail || session.email
        };
        submitter.disabled = true;
        refs.editorFeedback.textContent = "Salvando...";
        try {
          const saved = await window.AgendaGamaDataStore.save("activities", payload, []);
          state.activities = [saved].concat(state.activities.filter(function (item) { return item.id !== saved.id; }));
          renderSubjectOptions();
          render();
          closeEditor();
          setFeedback(saved.status === "published" ? "Atividade publicada." : "Rascunho salvo.", "success");
        } catch (error) {
          refs.editorFeedback.textContent = error.message || "Não foi possível salvar a atividade.";
          refs.editorFeedback.className = "feedback error";
        } finally {
          submitter.disabled = false;
        }
      });
      refs.completionStudent.addEventListener("change", function () {
        const activity = state.activities.find(function (item) { return item.id === state.activeId; });
        if (activity) syncCompletionButton(activity);
      });
      refs.completionForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const activity = state.activities.find(function (item) { return item.id === state.activeId; });
        const student = state.children.find(function (item) { return String(item.id) === String(refs.completionStudent.value); });
        if (!activity || !student || completionFor(activity.id, student.id)) return;
        refs.completionSubmit.disabled = true;
        refs.completionFeedback.textContent = "Salvando...";
        try {
          const saved = await window.AgendaGamaDataStore.save("activityCompletions", {
            id: null,
            activityId: activity.id,
            authUserId: session.userId,
            studentId: student.id,
            studentName: student.nome,
            turma: student.turma || "",
            responsibleName: session.name,
            responsibleEmail: session.email,
            completedAt: new Date().toISOString()
          }, []);
          state.completions = [saved].concat(state.completions);
          refs.completionFeedback.textContent = "Atividade marcada como concluída.";
          refs.completionFeedback.className = "feedback success";
          syncCompletionButton(activity);
          render();
        } catch (error) {
          refs.completionFeedback.textContent = error.message || "Não foi possível confirmar a conclusão.";
          refs.completionFeedback.className = "feedback error";
          refs.completionSubmit.disabled = false;
        }
      });
      refs.list.addEventListener("click", async function (event) {
        const viewId = event.target.closest("[data-activity-view]")?.dataset.activityView;
        const editId = event.target.closest("[data-activity-edit]")?.dataset.activityEdit;
        const completionsId = event.target.closest("[data-activity-completions]")?.dataset.activityCompletions;
        const deleteId = event.target.closest("[data-activity-delete]")?.dataset.activityDelete;
        const statusButton = event.target.closest("[data-activity-status]");
        const id = viewId || editId || completionsId || deleteId || statusButton?.dataset.activityId;
        const activity = state.activities.find(function (item) { return item.id === id; });
        if (!activity) return;
        if (viewId) openDetail(activity);
        if (editId && canManage(activity)) openEditor(activity);
        if (completionsId) openCompletions(activity);
        if (deleteId && canManage(activity)) {
          if (!window.confirm(`Excluir a atividade "${activity.title}" e todas as conclusões?`)) return;
          try {
            await window.AgendaGamaDataStore.remove("activities", activity.id, []);
            state.activities = state.activities.filter(function (item) { return item.id !== activity.id; });
            state.completions = state.completions.filter(function (item) { return item.activityId !== activity.id; });
            setFeedback("Atividade excluída.", "success");
            render();
          } catch (error) {
            setFeedback(error.message || "Não foi possível excluir a atividade.", "error");
          }
        }
        if (statusButton && canManage(activity)) {
          try {
            const saved = await window.AgendaGamaDataStore.save("activities", { ...activity, status: statusButton.dataset.activityStatus }, []);
            state.activities = [saved].concat(state.activities.filter(function (item) { return item.id !== saved.id; }));
            setFeedback(saved.status === "published" ? "Atividade publicada." : "Atividade encerrada.", "success");
            render();
          } catch (error) {
            setFeedback(error.message || "Não foi possível atualizar a atividade.", "error");
          }
        }
      });

      render();
    }

    ensureShellContent(function () {
      const session = window.AgendaGamaAuth.getSession();
      if (session) {
        init(session);
        return;
      }
      window.addEventListener("agenda-shell-ready", function handleReady(event) {
        window.removeEventListener("agenda-shell-ready", handleReady);
        init(event.detail?.session || null);
      });
    });
  }

  window.AgendaGamaSchoolActivities = { mount: mount };
})();
