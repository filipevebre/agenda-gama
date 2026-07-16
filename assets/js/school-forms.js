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

  function generateId(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${prefix || "item"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function categoryLabel(category) {
    return ({
      autorizacao: "Autorização",
      pesquisa: "Pesquisa",
      inscricao: "Inscrição",
      confirmacao: "Confirmação",
      geral: "Outro"
    })[category] || "Formulário";
  }

  function statusLabel(status) {
    return ({ draft: "Rascunho", published: "Publicado", closed: "Encerrado" })[status] || "Formulário";
  }

  function questionTypeLabel(type) {
    return ({
      short_text: "Texto curto",
      long_text: "Texto longo",
      yes_no: "Sim ou não",
      single_choice: "Escolha única",
      multiple_choice: "Múltipla escolha",
      date: "Data",
      number: "Número"
    })[type] || "Texto curto";
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

  function isExpired(form) {
    return Boolean(form?.closesAt) && new Date(form.closesAt).getTime() <= Date.now();
  }

  function isManager(session) {
    return session?.role !== "responsaveis";
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
    if (document.getElementById("school-form-list")) {
      callback();
      return;
    }
    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function normalizeQuestion(question) {
    return {
      id: question?.id || generateId("question"),
      label: String(question?.label || ""),
      type: String(question?.type || "short_text"),
      required: Boolean(question?.required),
      options: Array.isArray(question?.options) ? question.options.map(String).filter(Boolean) : []
    };
  }

  function defaultQuestions(category) {
    if (category === "autorizacao") {
      return [normalizeQuestion({
        label: "Autorizo a participação do(a) aluno(a)?",
        type: "yes_no",
        required: true
      })];
    }
    return [normalizeQuestion({ label: "Escreva sua resposta", type: "short_text", required: true })];
  }

  function answerDisplay(value) {
    if (Array.isArray(value)) return value.join(", ") || "Não respondido";
    if (value === null || value === undefined || value === "") return "Não respondido";
    return String(value);
  }

  function mount() {
    async function init(session) {
      if (!session || !window.AgendaGamaDataStore) return;

      const refs = {
        pageTitle: document.getElementById("form-page-title"),
        pageDescription: document.getElementById("form-page-description"),
        newButton: document.getElementById("school-form-new"),
        list: document.getElementById("school-form-list"),
        empty: document.getElementById("school-form-empty"),
        feedback: document.getElementById("school-form-feedback"),
        search: document.getElementById("school-form-search"),
        statusFilter: document.getElementById("school-form-status-filter"),
        categoryFilter: document.getElementById("school-form-category-filter"),
        boardTitle: document.getElementById("school-form-board-title"),
        boardCopy: document.getElementById("school-form-board-copy"),
        statMainLabel: document.getElementById("school-form-stat-main-label"),
        statMain: document.getElementById("school-form-stat-main"),
        statSecondaryLabel: document.getElementById("school-form-stat-secondary-label"),
        statSecondary: document.getElementById("school-form-stat-secondary"),
        statPendingLabel: document.getElementById("school-form-stat-pending-label"),
        statPending: document.getElementById("school-form-stat-pending"),
        editorModal: document.getElementById("school-form-editor-modal"),
        editorTitle: document.getElementById("school-form-editor-title"),
        editorClose: document.getElementById("school-form-editor-close"),
        editorCancel: document.getElementById("school-form-editor-cancel"),
        editor: document.getElementById("school-form-editor"),
        title: document.getElementById("school-form-title"),
        category: document.getElementById("school-form-category"),
        description: document.getElementById("school-form-description"),
        closesAt: document.getElementById("school-form-closes-at"),
        turmaList: document.getElementById("school-form-turma-list"),
        turmaEmpty: document.getElementById("school-form-turma-empty"),
        selectAllTurmas: document.getElementById("school-form-select-all-turmas"),
        clearTurmas: document.getElementById("school-form-clear-turmas"),
        questionList: document.getElementById("school-form-question-list"),
        addQuestion: document.getElementById("school-form-add-question"),
        editorFeedback: document.getElementById("school-form-editor-feedback"),
        answerModal: document.getElementById("school-form-answer-modal"),
        answerClose: document.getElementById("school-form-answer-close"),
        answerCancel: document.getElementById("school-form-answer-cancel"),
        answerForm: document.getElementById("school-form-answer"),
        answerTitle: document.getElementById("school-form-answer-title"),
        answerDescription: document.getElementById("school-form-answer-description"),
        answerCategory: document.getElementById("school-form-answer-category"),
        studentField: document.getElementById("school-form-student-field"),
        student: document.getElementById("school-form-student"),
        answerQuestions: document.getElementById("school-form-answer-questions"),
        answerSubmit: document.getElementById("school-form-answer-submit"),
        answerFeedback: document.getElementById("school-form-answer-feedback"),
        responsesModal: document.getElementById("school-form-responses-modal"),
        responsesClose: document.getElementById("school-form-responses-close"),
        responsesTitle: document.getElementById("school-form-responses-title"),
        responsesSummary: document.getElementById("school-form-responses-summary"),
        responseList: document.getElementById("school-form-response-list"),
        responsesEmpty: document.getElementById("school-form-responses-empty")
      };

      [refs.editorModal, refs.answerModal, refs.responsesModal].forEach(mountModalPortal);

      const [forms, responses, turmas, alunos, responsaveis] = await Promise.all([
        window.AgendaGamaDataStore.list("forms", []),
        window.AgendaGamaDataStore.list("formResponses", []),
        window.AgendaGamaDataStore.list("turmas", []),
        window.AgendaGamaDataStore.list("alunos", []),
        window.AgendaGamaDataStore.list("responsaveis", [])
      ]).catch(function (error) {
        refs.feedback.textContent = `Não foi possível carregar os formulários: ${error.message}`;
        refs.feedback.className = "feedback error";
        return [[], [], [], [], []];
      });

      const state = {
        forms: forms || [],
        responses: responses || [],
        turmas: turmas || [],
        alunos: alunos || [],
        responsaveis: responsaveis || [],
        children: [],
        editingId: null,
        editorQuestions: [],
        activeFormId: null,
        previewMode: false
      };

      state.children = getLinkedChildren();

      function getLinkedChildren() {
        if (session.role !== "responsaveis") return [];
        const records = state.responsaveis.filter(function (item) {
          return String(item.auth_user_id || "") === String(session.userId || "")
            || normalizeText(item.email) === normalizeText(session.email);
        });
        const children = [];
        records.forEach(function (record) {
          const student = state.alunos.find(function (item) {
            return String(item.id || "") === String(record.aluno_id || "")
              || normalizeText(item.nome) === normalizeText(record.aluno);
          });
          if (student && !children.some(function (item) { return item.id === student.id; })) {
            children.push(student);
          }
        });
        return children;
      }

      function formResponses(formId) {
        return state.responses.filter(function (item) { return String(item.formId) === String(formId); });
      }

      function eligibleChildren(form) {
        const targets = form.targetTurmas || [];
        return state.children.filter(function (student) {
          return !targets.length || targets.some(function (turma) { return turmaMatches(turma, student.turma); });
        });
      }

      function responseFor(formId, studentId) {
        return state.responses.find(function (item) {
          return String(item.formId) === String(formId) && String(item.studentId) === String(studentId);
        }) || null;
      }

      function setFeedback(message, type) {
        refs.feedback.textContent = message || "";
        refs.feedback.className = `feedback${type ? ` ${type}` : ""}`;
      }

      function getEffectiveStatus(form) {
        return form.status === "published" && isExpired(form) ? "closed" : form.status;
      }

      function formMatchesFilters(form) {
        const search = normalizeText(refs.search.value);
        const category = refs.categoryFilter.value;
        const status = refs.statusFilter.value;
        const haystack = normalizeText(`${form.title} ${form.description} ${categoryLabel(form.category)}`);
        if (search && !haystack.includes(search)) return false;
        if (category !== "all" && form.category !== category) return false;

        if (session.role === "responsaveis") {
          const children = eligibleChildren(form);
          const answered = children.length > 0 && children.every(function (child) {
            return Boolean(responseFor(form.id, child.id));
          });
          if (status === "pending" && answered) return false;
          if (status === "answered" && !answered) return false;
          if (["published", "draft", "closed"].includes(status) && getEffectiveStatus(form) !== status) return false;
          return true;
        }

        return status === "all" || status === getEffectiveStatus(form);
      }

      function renderStats() {
        if (session.role === "responsaveis") {
          const visible = state.forms.filter(function (form) { return eligibleChildren(form).length; });
          const pending = visible.filter(function (form) {
            return getEffectiveStatus(form) === "published" && eligibleChildren(form).some(function (child) {
              return !responseFor(form.id, child.id);
            });
          }).length;
          const answered = visible.filter(function (form) {
            return eligibleChildren(form).some(function (child) { return Boolean(responseFor(form.id, child.id)); });
          }).length;
          refs.statMainLabel.textContent = "Disponíveis";
          refs.statMain.textContent = visible.filter(function (form) { return getEffectiveStatus(form) === "published"; }).length;
          refs.statSecondaryLabel.textContent = "Respondidos";
          refs.statSecondary.textContent = answered;
          refs.statPendingLabel.textContent = "Pendentes";
          refs.statPending.textContent = pending;
          return;
        }

        refs.statMain.textContent = state.forms.filter(function (form) { return getEffectiveStatus(form) === "published"; }).length;
        refs.statSecondary.textContent = state.responses.length;
        refs.statPendingLabel.textContent = "Rascunhos";
        refs.statPending.textContent = state.forms.filter(function (form) { return form.status === "draft"; }).length;
      }

      function managerCard(form) {
        const responses = formResponses(form.id);
        const effectiveStatus = getEffectiveStatus(form);
        const targets = form.targetTurmas?.length ? form.targetTurmas.join(", ") : "Todas as turmas";
        const canEdit = responses.length === 0;
        return `
          <article class="school-form-card">
            <div class="school-form-card-top">
              <span class="school-form-category-icon">${escapeHtml(categoryLabel(form.category).slice(0, 2).toUpperCase())}</span>
              <div class="school-form-card-copy">
                <div class="card-head">
                  <div>
                    <h3 class="card-title">${escapeHtml(form.title)}</h3>
                    <p>${escapeHtml(form.description || "Sem orientações adicionais.")}</p>
                  </div>
                  <span class="status-badge school-form-status-${escapeHtml(effectiveStatus)}">${escapeHtml(statusLabel(effectiveStatus))}</span>
                </div>
                <div class="inline-tags school-form-card-tags">
                  <span class="tag">${escapeHtml(categoryLabel(form.category))}</span>
                  <span class="tag">${escapeHtml(targets)}</span>
                  <span class="tag">${form.questions?.length || 0} pergunta(s)</span>
                </div>
              </div>
            </div>
            <div class="school-form-card-footer">
              <div class="school-form-card-metrics">
                <strong>${responses.length}</strong><span>resposta(s)</span>
                <small>${form.closesAt ? `Prazo: ${escapeHtml(formatDate(form.closesAt))}` : "Sem prazo definido"}</small>
              </div>
              <div class="school-form-card-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-form-preview="${escapeHtml(form.id)}">Visualizar</button>
                <button class="btn btn-secondary btn-sm" type="button" data-form-responses="${escapeHtml(form.id)}">Respostas</button>
                ${canEdit ? `<button class="btn btn-secondary btn-sm" type="button" data-form-edit="${escapeHtml(form.id)}">Editar</button>` : ""}
                ${effectiveStatus === "draft" ? `<button class="btn btn-primary btn-sm" type="button" data-form-status="published" data-form-id="${escapeHtml(form.id)}">Publicar</button>` : ""}
                ${effectiveStatus === "published" ? `<button class="btn btn-secondary btn-sm" type="button" data-form-status="closed" data-form-id="${escapeHtml(form.id)}">Encerrar</button>` : ""}
                <button class="btn btn-danger btn-sm" type="button" data-form-delete="${escapeHtml(form.id)}">Excluir</button>
              </div>
            </div>
          </article>
        `;
      }

      function guardianCard(form) {
        const children = eligibleChildren(form);
        const answeredCount = children.filter(function (child) { return responseFor(form.id, child.id); }).length;
        const effectiveStatus = getEffectiveStatus(form);
        const pending = effectiveStatus === "published" && answeredCount < children.length;
        const badgeClass = pending
          ? "school-form-status-pending"
          : answeredCount
            ? "school-form-status-answered"
            : "school-form-status-closed";
        return `
          <button class="school-form-card school-form-family-card" type="button" data-form-answer="${escapeHtml(form.id)}">
            <span class="school-form-category-icon">${escapeHtml(categoryLabel(form.category).slice(0, 2).toUpperCase())}</span>
            <span class="school-form-card-copy">
              <span class="school-form-family-head">
                <strong>${escapeHtml(form.title)}</strong>
                <span class="status-badge ${badgeClass}">${pending ? "Pendente" : answeredCount ? "Respondido" : statusLabel(effectiveStatus)}</span>
              </span>
              <span class="school-form-card-description">${escapeHtml(form.description || "Toque para ver o formulário.")}</span>
              <span class="school-form-family-meta">${escapeHtml(categoryLabel(form.category))} · ${children.map(function (child) { return child.nome; }).join(", ")} · ${escapeHtml(formatDate(form.closesAt))}</span>
            </span>
            <span class="school-form-card-arrow">›</span>
          </button>
        `;
      }

      function render() {
        renderStats();
        const visibleForms = state.forms
          .filter(function (form) { return session.role !== "responsaveis" || eligibleChildren(form).length; })
          .filter(formMatchesFilters)
          .sort(function (left, right) { return new Date(right.createdAt || 0) - new Date(left.createdAt || 0); });
        refs.list.innerHTML = visibleForms.map(function (form) {
          return session.role === "responsaveis" ? guardianCard(form) : managerCard(form);
        }).join("");
        refs.empty.hidden = Boolean(visibleForms.length);
      }

      function renderTurmaTargets(selected) {
        refs.turmaList.innerHTML = state.turmas.map(function (turma) {
          const checked = selected.some(function (name) { return turmaMatches(name, turma.nome); });
          return `
            <label class="school-form-target-option">
              <input type="checkbox" value="${escapeHtml(turma.nome)}" ${checked ? "checked" : ""}>
              <span><strong>${escapeHtml(turma.nome)}</strong><small>${escapeHtml(turma.turno || "")}</small></span>
            </label>
          `;
        }).join("");
        refs.turmaEmpty.hidden = Boolean(state.turmas.length);
      }

      function syncQuestionFromElement(element) {
        const row = element.closest("[data-question-id]");
        const question = state.editorQuestions.find(function (item) { return item.id === row?.dataset.questionId; });
        if (!question) return;
        if (element.matches("[data-question-label]")) question.label = element.value;
        if (element.matches("[data-question-type]")) question.type = element.value;
        if (element.matches("[data-question-required]")) question.required = element.checked;
        if (element.matches("[data-question-options]")) {
          question.options = element.value.split("\n").map(function (item) { return item.trim(); }).filter(Boolean);
        }
      }

      function renderQuestionEditor() {
        refs.questionList.innerHTML = state.editorQuestions.map(function (question, index) {
          const needsOptions = ["single_choice", "multiple_choice"].includes(question.type);
          return `
            <article class="school-form-question-editor" data-question-id="${escapeHtml(question.id)}">
              <div class="school-form-question-number">${index + 1}</div>
              <div class="school-form-question-fields">
                <label class="field">
                  <span>Pergunta</span>
                  <input data-question-label type="text" maxlength="240" value="${escapeHtml(question.label)}" placeholder="Digite a pergunta">
                </label>
                <div class="school-form-question-config">
                  <label class="field">
                    <span>Tipo de resposta</span>
                    <select data-question-type>
                      ${["short_text", "long_text", "yes_no", "single_choice", "multiple_choice", "date", "number"].map(function (type) {
                        return `<option value="${type}" ${question.type === type ? "selected" : ""}>${questionTypeLabel(type)}</option>`;
                      }).join("")}
                    </select>
                  </label>
                  <label class="checkbox-pill school-form-required-option">
                    <input data-question-required type="checkbox" ${question.required ? "checked" : ""}>
                    <span>Obrigatória</span>
                  </label>
                </div>
                ${needsOptions ? `
                  <label class="field">
                    <span>Opções, uma por linha</span>
                    <textarea data-question-options rows="3" placeholder="Opção 1&#10;Opção 2">${escapeHtml(question.options.join("\n"))}</textarea>
                  </label>
                ` : ""}
              </div>
              <div class="school-form-question-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-question-move="up" aria-label="Mover para cima">↑</button>
                <button type="button" class="btn btn-secondary btn-sm" data-question-move="down" aria-label="Mover para baixo">↓</button>
                <button type="button" class="btn btn-danger btn-sm" data-question-remove aria-label="Remover pergunta">x</button>
              </div>
            </article>
          `;
        }).join("");
      }

      function openEditor(form) {
        state.editingId = form?.id || null;
        state.editorQuestions = (form?.questions?.length ? form.questions : defaultQuestions(form?.category || "autorizacao")).map(normalizeQuestion);
        refs.editorTitle.textContent = form ? "Editar formulário" : "Novo formulário";
        refs.title.value = form?.title || "";
        refs.category.value = form?.category || "autorizacao";
        refs.description.value = form?.description || "";
        refs.closesAt.value = toLocalDateTime(form?.closesAt);
        refs.editorFeedback.textContent = "";
        renderTurmaTargets(form?.targetTurmas || []);
        renderQuestionEditor();
        setModalOpen(refs.editorModal, true);
        setTimeout(function () { refs.title.focus(); }, 50);
      }

      function closeEditor() {
        setModalOpen(refs.editorModal, false);
        state.editingId = null;
      }

      function buildAnswerField(question, value, preview) {
        const name = `answer-${question.id}`;
        const required = question.required && !preview ? "required" : "";
        const disabled = preview ? "disabled" : "";
        const safeValue = value === undefined || value === null ? "" : value;
        let control = "";
        if (question.type === "long_text") {
          control = `<textarea name="${escapeHtml(name)}" rows="4" ${required} ${disabled}>${escapeHtml(safeValue)}</textarea>`;
        } else if (question.type === "yes_no") {
          control = `<div class="school-form-choice-grid">${["Sim", "Não"].map(function (option) {
            return `<label class="school-form-choice"><input type="radio" name="${escapeHtml(name)}" value="${option}" ${safeValue === option ? "checked" : ""} ${required} ${disabled}><span>${option}</span></label>`;
          }).join("")}</div>`;
        } else if (question.type === "single_choice") {
          control = `<div class="school-form-choice-grid">${question.options.map(function (option) {
            return `<label class="school-form-choice"><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(option)}" ${safeValue === option ? "checked" : ""} ${required} ${disabled}><span>${escapeHtml(option)}</span></label>`;
          }).join("")}</div>`;
        } else if (question.type === "multiple_choice") {
          const selected = Array.isArray(safeValue) ? safeValue : [];
          control = `<div class="school-form-choice-grid">${question.options.map(function (option) {
            return `<label class="school-form-choice"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option)}" ${selected.includes(option) ? "checked" : ""} ${disabled}><span>${escapeHtml(option)}</span></label>`;
          }).join("")}</div>`;
        } else {
          const inputType = question.type === "date" ? "date" : question.type === "number" ? "number" : "text";
          control = `<input type="${inputType}" name="${escapeHtml(name)}" value="${escapeHtml(safeValue)}" ${required} ${disabled}>`;
        }
        return `
          <fieldset class="school-form-answer-question" data-answer-question="${escapeHtml(question.id)}">
            <legend>${escapeHtml(question.label)}${question.required ? " *" : ""}</legend>
            ${control}
          </fieldset>
        `;
      }

      function renderAnswerQuestions() {
        const form = state.forms.find(function (item) { return item.id === state.activeFormId; });
        if (!form) return;
        const response = state.previewMode ? null : responseFor(form.id, refs.student.value);
        refs.answerQuestions.innerHTML = form.questions.map(function (question) {
          return buildAnswerField(normalizeQuestion(question), response?.answers?.[question.id], state.previewMode);
        }).join("");
        refs.answerSubmit.textContent = response ? "Atualizar respostas" : "Enviar respostas";
      }

      function openAnswer(form, preview) {
        state.activeFormId = form.id;
        state.previewMode = Boolean(preview);
        refs.answerTitle.textContent = preview ? `Prévia: ${form.title}` : form.title;
        refs.answerDescription.textContent = form.description || "";
        refs.answerCategory.textContent = categoryLabel(form.category);
        refs.answerFeedback.textContent = "";
        refs.studentField.hidden = Boolean(preview);
        refs.answerSubmit.hidden = Boolean(preview) || getEffectiveStatus(form) !== "published";
        refs.answerCancel.textContent = preview ? "Fechar" : "Cancelar";

        if (!preview) {
          const children = eligibleChildren(form);
          refs.student.innerHTML = children.map(function (student) {
            return `<option value="${escapeHtml(student.id)}">${escapeHtml(student.nome)} · ${escapeHtml(student.turma || "Sem turma")}</option>`;
          }).join("");
          if (!children.length) {
            refs.answerFeedback.textContent = "Nenhum aluno vinculado pode responder este formulário.";
            refs.answerFeedback.className = "feedback error";
            refs.answerSubmit.hidden = true;
          }
        }
        renderAnswerQuestions();
        setModalOpen(refs.answerModal, true);
      }

      function closeAnswer() {
        setModalOpen(refs.answerModal, false);
        state.activeFormId = null;
      }

      function openResponses(form) {
        const responses = formResponses(form.id).sort(function (left, right) {
          return new Date(right.submittedAt || 0) - new Date(left.submittedAt || 0);
        });
        refs.responsesTitle.textContent = `Respostas: ${form.title}`;
        refs.responsesSummary.textContent = `${responses.length} resposta(s) recebida(s).`;
        refs.responseList.innerHTML = responses.map(function (response) {
          return `
            <article class="school-form-response-card">
              <div class="card-head">
                <div><h3>${escapeHtml(response.studentName)}</h3><p>${escapeHtml(response.turma)} · Responsável: ${escapeHtml(response.responsibleName)}</p></div>
                <small>${escapeHtml(formatDate(response.submittedAt))}</small>
              </div>
              <dl>${form.questions.map(function (question) {
                return `<div><dt>${escapeHtml(question.label)}</dt><dd>${escapeHtml(answerDisplay(response.answers?.[question.id]))}</dd></div>`;
              }).join("")}</dl>
            </article>
          `;
        }).join("");
        refs.responsesEmpty.hidden = Boolean(responses.length);
        setModalOpen(refs.responsesModal, true);
      }

      refs.newButton.hidden = !isManager(session);
      if (session.role === "responsaveis") {
        refs.pageTitle.textContent = "Formulários para sua família";
        refs.pageDescription.textContent = "Responda autorizações e solicitações enviadas pela escola.";
        refs.boardTitle.textContent = "Para responder";
        refs.boardCopy.textContent = "Abra um item para preencher ou consultar sua resposta.";
        Array.from(refs.statusFilter.options).forEach(function (option) {
          option.hidden = ["draft"].includes(option.value);
        });
      } else {
        Array.from(refs.statusFilter.options).forEach(function (option) {
          option.hidden = ["pending", "answered"].includes(option.value);
        });
      }

      refs.newButton.addEventListener("click", function () { openEditor(null); });
      refs.editorClose.addEventListener("click", closeEditor);
      refs.editorCancel.addEventListener("click", closeEditor);
      refs.editorModal.addEventListener("click", function (event) {
        if (event.target.matches("[data-school-form-close-editor]")) closeEditor();
      });
      refs.answerClose.addEventListener("click", closeAnswer);
      refs.answerCancel.addEventListener("click", closeAnswer);
      refs.answerModal.addEventListener("click", function (event) {
        if (event.target.matches("[data-school-form-close-answer]")) closeAnswer();
      });
      refs.responsesClose.addEventListener("click", function () { setModalOpen(refs.responsesModal, false); });
      refs.responsesModal.addEventListener("click", function (event) {
        if (event.target.matches("[data-school-form-close-responses]")) setModalOpen(refs.responsesModal, false);
      });

      refs.search.addEventListener("input", render);
      refs.statusFilter.addEventListener("change", render);
      refs.categoryFilter.addEventListener("change", render);
      refs.student.addEventListener("change", renderAnswerQuestions);

      refs.selectAllTurmas.addEventListener("click", function () {
        refs.turmaList.querySelectorAll("input[type=checkbox]").forEach(function (input) { input.checked = true; });
      });
      refs.clearTurmas.addEventListener("click", function () {
        refs.turmaList.querySelectorAll("input[type=checkbox]").forEach(function (input) { input.checked = false; });
      });
      refs.addQuestion.addEventListener("click", function () {
        state.editorQuestions.push(normalizeQuestion({ label: "", type: "short_text", required: false }));
        renderQuestionEditor();
        refs.questionList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      refs.questionList.addEventListener("input", function (event) { syncQuestionFromElement(event.target); });
      refs.questionList.addEventListener("change", function (event) {
        syncQuestionFromElement(event.target);
        if (event.target.matches("[data-question-type]")) renderQuestionEditor();
      });
      refs.questionList.addEventListener("click", function (event) {
        const row = event.target.closest("[data-question-id]");
        if (!row) return;
        const index = state.editorQuestions.findIndex(function (item) { return item.id === row.dataset.questionId; });
        if (event.target.closest("[data-question-remove]")) {
          if (state.editorQuestions.length === 1) {
            refs.editorFeedback.textContent = "O formulário precisa ter pelo menos uma pergunta.";
            refs.editorFeedback.className = "feedback error";
            return;
          }
          state.editorQuestions.splice(index, 1);
          renderQuestionEditor();
          return;
        }
        const move = event.target.closest("[data-question-move]")?.dataset.questionMove;
        const nextIndex = move === "up" ? index - 1 : move === "down" ? index + 1 : index;
        if (nextIndex >= 0 && nextIndex < state.editorQuestions.length && nextIndex !== index) {
          const item = state.editorQuestions.splice(index, 1)[0];
          state.editorQuestions.splice(nextIndex, 0, item);
          renderQuestionEditor();
        }
      });

      refs.editor.addEventListener("submit", async function (event) {
        event.preventDefault();
        const status = event.submitter?.dataset.saveStatus || "draft";
        const selectedTurmas = Array.from(refs.turmaList.querySelectorAll("input:checked")).map(function (input) { return input.value; });
        const questions = state.editorQuestions.map(normalizeQuestion);
        if (!refs.title.value.trim()) {
          refs.editorFeedback.textContent = "Informe o título do formulário.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        if (session.role === "professores" && !selectedTurmas.length) {
          refs.editorFeedback.textContent = "Selecione ao menos uma das suas turmas.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        if (!questions.length || questions.some(function (question) { return !question.label.trim(); })) {
          refs.editorFeedback.textContent = "Preencha o texto de todas as perguntas.";
          refs.editorFeedback.className = "feedback error";
          return;
        }
        if (questions.some(function (question) {
          return ["single_choice", "multiple_choice"].includes(question.type) && question.options.length < 2;
        })) {
          refs.editorFeedback.textContent = "Perguntas de escolha precisam de pelo menos duas opções.";
          refs.editorFeedback.className = "feedback error";
          return;
        }

        const current = state.forms.find(function (form) { return form.id === state.editingId; });
        const payload = {
          ...current,
          id: current?.id || null,
          title: refs.title.value.trim(),
          description: refs.description.value.trim(),
          category: refs.category.value,
          status: status,
          targetTurmas: selectedTurmas,
          questions: questions,
          closesAt: refs.closesAt.value ? new Date(refs.closesAt.value).toISOString() : "",
          authorUserId: current?.authorUserId || session.userId || null,
          authorName: current?.authorName || session.name,
          authorEmail: current?.authorEmail || session.email,
          createdAt: current?.createdAt || new Date().toISOString()
        };
        refs.editorFeedback.textContent = "Salvando...";
        refs.editorFeedback.className = "feedback";
        try {
          const saved = await window.AgendaGamaDataStore.save("forms", payload, []);
          state.forms = [saved].concat(state.forms.filter(function (item) { return item.id !== saved.id; }));
          closeEditor();
          setFeedback(status === "published" ? "Formulário publicado para as famílias." : "Rascunho salvo.", "success");
          render();
        } catch (error) {
          refs.editorFeedback.textContent = error.message || "Não foi possível salvar o formulário.";
          refs.editorFeedback.className = "feedback error";
        }
      });

      refs.answerForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = state.forms.find(function (item) { return item.id === state.activeFormId; });
        const student = state.children.find(function (item) { return String(item.id) === String(refs.student.value); });
        if (!form || !student || getEffectiveStatus(form) !== "published") return;
        const answers = {};
        let missingRequired = false;
        form.questions.map(normalizeQuestion).forEach(function (question) {
          const name = `answer-${question.id}`;
          let value;
          if (question.type === "multiple_choice") {
            value = Array.from(refs.answerForm.querySelectorAll(`[name="${CSS.escape(name)}"]:checked`)).map(function (input) { return input.value; });
          } else if (["yes_no", "single_choice"].includes(question.type)) {
            value = refs.answerForm.querySelector(`[name="${CSS.escape(name)}"]:checked`)?.value || "";
          } else {
            value = refs.answerForm.elements[name]?.value?.trim() || "";
          }
          answers[question.id] = value;
          if (question.required && (!value || (Array.isArray(value) && !value.length))) missingRequired = true;
        });
        if (missingRequired) {
          refs.answerFeedback.textContent = "Responda todas as perguntas obrigatórias.";
          refs.answerFeedback.className = "feedback error";
          return;
        }
        const current = responseFor(form.id, student.id);
        const payload = {
          ...current,
          id: current?.id || null,
          formId: form.id,
          authUserId: session.userId,
          responsibleName: session.name,
          responsibleEmail: session.email,
          studentId: student.id,
          studentName: student.nome,
          turma: student.turma || "",
          answers: answers,
          submittedAt: new Date().toISOString()
        };
        refs.answerSubmit.disabled = true;
        refs.answerFeedback.textContent = "Enviando...";
        try {
          const saved = await window.AgendaGamaDataStore.save("formResponses", payload, []);
          state.responses = [saved].concat(state.responses.filter(function (item) { return item.id !== saved.id; }));
          refs.answerFeedback.textContent = "Respostas enviadas com sucesso.";
          refs.answerFeedback.className = "feedback success";
          refs.answerSubmit.textContent = "Atualizar respostas";
          render();
        } catch (error) {
          refs.answerFeedback.textContent = error.message || "Não foi possível enviar as respostas.";
          refs.answerFeedback.className = "feedback error";
        } finally {
          refs.answerSubmit.disabled = false;
        }
      });

      refs.list.addEventListener("click", async function (event) {
        const answerId = event.target.closest("[data-form-answer]")?.dataset.formAnswer;
        const previewId = event.target.closest("[data-form-preview]")?.dataset.formPreview;
        const editId = event.target.closest("[data-form-edit]")?.dataset.formEdit;
        const responsesId = event.target.closest("[data-form-responses]")?.dataset.formResponses;
        const deleteId = event.target.closest("[data-form-delete]")?.dataset.formDelete;
        const statusButton = event.target.closest("[data-form-status]");
        const formId = answerId || previewId || editId || responsesId || deleteId || statusButton?.dataset.formId;
        const form = state.forms.find(function (item) { return item.id === formId; });
        if (!form) return;
        if (answerId) openAnswer(form, false);
        if (previewId) openAnswer(form, true);
        if (editId) openEditor(form);
        if (responsesId) openResponses(form);
        if (deleteId) {
          if (!window.confirm(`Excluir o formulário "${form.title}" e todas as respostas?`)) return;
          try {
            await window.AgendaGamaDataStore.remove("forms", form.id, []);
            state.forms = state.forms.filter(function (item) { return item.id !== form.id; });
            state.responses = state.responses.filter(function (item) { return item.formId !== form.id; });
            setFeedback("Formulário excluído.", "success");
            render();
          } catch (error) {
            setFeedback(error.message || "Não foi possível excluir.", "error");
          }
        }
        if (statusButton) {
          try {
            const saved = await window.AgendaGamaDataStore.save("forms", { ...form, status: statusButton.dataset.formStatus }, []);
            state.forms = [saved].concat(state.forms.filter(function (item) { return item.id !== saved.id; }));
            setFeedback(saved.status === "published" ? "Formulário publicado." : "Formulário encerrado.", "success");
            render();
          } catch (error) {
            setFeedback(error.message || "Não foi possível atualizar.", "error");
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

  window.AgendaGamaSchoolForms = { mount: mount };
})();
