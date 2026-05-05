(function () {
  const DIARIO_SEED = [
    {
      id: "diario-demo-1",
      studentId: "aluno-demo-1",
      studentName: "Ana Clara Silva",
      turma: "5o Ano B",
      turno: "Tarde",
      category: "rotina",
      title: "Participacao e rotina",
      body: "Hoje a Ana participou bem das atividades, concluiu as tarefas em sala e manteve uma rotina tranquila durante o periodo.",
      photos: [],
      authorName: "Prof. Helena Souza",
      authorEmail: "professor@gama.edu.br",
      authorRole: "professores",
      targetMode: "students",
      recipientCount: 1,
      entryDate: "2026-05-04",
      createdAt: "2026-05-04T13:20:00.000Z",
      updatedAt: "2026-05-04T13:20:00.000Z"
    },
    {
      id: "diario-demo-2",
      studentId: "aluno-demo-2",
      studentName: "Pedro Henrique",
      turma: "1o Ano A",
      turno: "Manha",
      category: "atividade",
      title: "Atividade de leitura",
      body: "O Pedro se envolveu bastante na roda de leitura e compartilhou exemplos com a turma durante a atividade.",
      photos: [],
      authorName: "Prof. Helena Souza",
      authorEmail: "professor@gama.edu.br",
      authorRole: "professores",
      targetMode: "students",
      recipientCount: 1,
      entryDate: "2026-05-03",
      createdAt: "2026-05-03T15:10:00.000Z",
      updatedAt: "2026-05-03T15:10:00.000Z"
    }
  ];

  const CATEGORY_LABELS = {
    rotina: "Rotina",
    alimentacao: "Alimentacao",
    atividade: "Atividade",
    comportamento: "Comportamento",
    saude: "Saude"
  };

  const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full"
  });
  const TIME_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });

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

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizePersonName(value) {
    return normalizeText(value).replace(/^(prof|profa|professor|professora)\.?\s+/, "");
  }

  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `diario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateLabel(value) {
    if (!value) return "-";
    try {
      return DATE_LABEL_FORMATTER.format(new Date(`${value}T00:00:00`));
    } catch (error) {
      return value;
    }
  }

  function formatDateTimeLabel(value) {
    if (!value) return "";
    try {
      const date = new Date(value);
      return `${date.toLocaleDateString("pt-BR")} - ${TIME_LABEL_FORMATTER.format(date)}`;
    } catch (error) {
      return value;
    }
  }

  function buildCategoryLabel(value) {
    return CATEGORY_LABELS[value] || "Registro";
  }

  function getSelectedValues(select) {
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map(function (option) {
      return option.value;
    }).filter(Boolean);
  }

  function setSelectedValues(select, values) {
    if (!select) return;
    const expected = new Set(Array.isArray(values) ? values : []);
    Array.from(select.options || []).forEach(function (option) {
      option.selected = expected.has(option.value);
    });
  }

  function sortEntries(items) {
    return [...items].sort(function (left, right) {
      const leftTime = new Date(`${left.entryDate || "1970-01-01"}T00:00:00`).getTime();
      const rightTime = new Date(`${right.entryDate || "1970-01-01"}T00:00:00`).getTime();
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
    });
  }

  function sortStudents(items) {
    return [...items].sort(function (left, right) {
      return String(left?.nome || "").localeCompare(String(right?.nome || ""), "pt-BR");
    });
  }

  function sortTurmas(items) {
    return [...items].sort(function (left, right) {
      return String(left?.nome || "").localeCompare(String(right?.nome || ""), "pt-BR");
    });
  }

  function ensureShellContent(callback) {
    if (document.getElementById("diario-form") || document.getElementById("diario-list")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  async function loadDirectory() {
    const [turmas, alunos, responsaveis, professores, equipe] = await Promise.all([
      window.AgendaGamaDataStore.list("turmas", []),
      window.AgendaGamaDataStore.list("alunos", []),
      window.AgendaGamaDataStore.list("responsaveis", []),
      window.AgendaGamaDataStore.list("professores", []),
      window.AgendaGamaDataStore.list("equipe", [])
    ]);

    return {
      turmas: turmas || [],
      alunos: alunos || [],
      responsaveis: responsaveis || [],
      professores: professores || [],
      equipe: equipe || []
    };
  }

  function buildActorContext(session, directory) {
    const professor = (directory.professores || []).find(function (item) {
      return normalizeEmail(item.email) === normalizeEmail(session?.email)
        || normalizePersonName(item.nome) === normalizePersonName(session?.name);
    }) || null;
    const responsavelRecords = (directory.responsaveis || []).filter(function (item) {
      return normalizeEmail(item.email) === normalizeEmail(session?.email);
    });

    const professorTurmas = new Set();
    if (professor?.turmas) {
      String(professor.turmas || "")
        .split(",")
        .map(function (item) { return item.trim(); })
        .filter(Boolean)
        .forEach(function (turma) {
          professorTurmas.add(turma);
        });
    } else if (professor?.turno) {
      (directory.turmas || []).forEach(function (turma) {
        if (normalizeText(turma.turno) === normalizeText(professor.turno)) {
          professorTurmas.add(turma.nome);
        }
      });
    }

    const linkedStudentIds = new Set();
    responsavelRecords.forEach(function (record) {
      if (record.aluno_id) {
        linkedStudentIds.add(record.aluno_id);
        return;
      }

      const student = (directory.alunos || []).find(function (item) {
        return normalizeText(item.nome) === normalizeText(record.aluno);
      }) || null;
      if (student?.id) {
        linkedStudentIds.add(student.id);
      }
    });

    return {
      professorTurmas: professorTurmas,
      responsavelRecords: responsavelRecords,
      linkedStudentIds: linkedStudentIds
    };
  }

  function getAccessibleStudents(session, actorContext, directory) {
    if (session.role === "administrador" || session.role === "funcionarios") {
      return sortStudents(directory.alunos || []);
    }

    if (session.role === "professores") {
      return sortStudents((directory.alunos || []).filter(function (student) {
        return actorContext.professorTurmas.has(student.turma);
      }));
    }

    if (session.role === "responsaveis") {
      return sortStudents((directory.alunos || []).filter(function (student) {
        return actorContext.linkedStudentIds.has(student.id);
      }));
    }

    return [];
  }

  function getAccessibleTurmas(accessibleStudents, directory) {
    const turmaMap = new Map();

    accessibleStudents.forEach(function (student) {
      if (!student.turma) return;

      if (!turmaMap.has(student.turma)) {
        const matchedTurma = (directory.turmas || []).find(function (item) {
          return normalizeText(item.nome) === normalizeText(student.turma);
        }) || null;

        turmaMap.set(student.turma, {
          nome: student.turma,
          turno: student.turno || matchedTurma?.turno || ""
        });
      }
    });

    return sortTurmas(Array.from(turmaMap.values()));
  }

  function canCreateEntries(session) {
    return ["administrador", "funcionarios", "professores"].includes(session?.role);
  }

  function canManageEntry(session, entry) {
    if (!session || !entry) return false;
    if (session.role === "administrador" || session.role === "funcionarios") return true;
    return session.role === "professores" && normalizeEmail(session.email) === normalizeEmail(entry.authorEmail);
  }

  function getResponsavelNamesByStudent(directory) {
    const namesMap = new Map();

    (directory.responsaveis || []).forEach(function (item) {
      const key = item.aluno_id || normalizeText(item.aluno);
      if (!key) return;
      if (!namesMap.has(key)) {
        namesMap.set(key, []);
      }
      namesMap.get(key).push(item.nome);
    });

    return namesMap;
  }

  function buildStudentOptions(students) {
    return students.map(function (student) {
      const label = `${student.nome} - ${student.turma || "Sem turma"}`;
      return `<option value="${escapeHtml(student.id)}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function buildTurmaOptions(turmas) {
    return turmas.map(function (turma) {
      const label = turma.turno ? `${turma.nome} - ${turma.turno}` : turma.nome;
      return `<option value="${escapeHtml(turma.nome)}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Nao foi possivel ler a imagem enviada."));
      };
      reader.readAsDataURL(file);
    });
  }

  function compressImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.width || 1, image.height || 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.width || 1) * scale));
        canvas.height = Math.max(1, Math.round((image.height || 1) * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Nao foi possivel preparar a foto para envio."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = function () {
        reject(new Error("A imagem enviada nao pode ser processada."));
      };
      image.src = dataUrl;
    });
  }

  async function buildPhotoRecord(file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Envie apenas arquivos de imagem.");
    }

    const dataUrl = await readFileAsDataUrl(file);
    const compressedUrl = await compressImage(dataUrl);

    return {
      id: generateId(),
      name: file.name,
      url: compressedUrl
    };
  }

  function buildPhotoGrid(photos) {
    const items = Array.isArray(photos) ? photos : [];
    if (!items.length) return "";

    return `
      <div class="diary-photo-grid">
        ${items.map(function (photo) {
          return `
            <a class="diary-photo" href="${escapeHtml(photo.url)}" target="_blank" rel="noreferrer">
              <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name || "Foto do diario")}">
            </a>
          `;
        }).join("")}
      </div>
    `;
  }

  function buildDiaryCard(entry, session, responsavelNamesMap) {
    const key = entry.studentId || normalizeText(entry.studentName);
    const responsavelNames = (responsavelNamesMap.get(key) || []).slice(0, 3);
    const responsavelSummary = responsavelNames.length
      ? responsavelNames.join(", ")
      : "Familia vinculada";

    const actions = canManageEntry(session, entry)
      ? `
        <div class="diary-card-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-diario-edit-id="${escapeHtml(entry.id)}">Editar</button>
          <button type="button" class="btn btn-secondary btn-sm" data-diario-remove-id="${escapeHtml(entry.id)}">Excluir</button>
        </div>
      `
      : "";

    return `
      <article class="diary-card">
        <div class="card-head diary-card-head">
          <div>
            <h3 class="card-title">${escapeHtml(entry.title || "Registro do dia")}</h3>
            <p class="diary-card-meta">${escapeHtml(entry.studentName)} - ${escapeHtml(entry.turma || "Sem turma")} - ${escapeHtml(buildCategoryLabel(entry.category))}</p>
          </div>
          <div class="diary-card-time">
            <strong>${escapeHtml(formatDateLabel(entry.entryDate))}</strong>
            <small>${escapeHtml(formatDateTimeLabel(entry.updatedAt || entry.createdAt))}</small>
          </div>
        </div>
        <div class="inline-tags">
          <span class="tag">${escapeHtml(buildCategoryLabel(entry.category))}</span>
          <span class="tag notice-tag-turma">${escapeHtml(entry.turma || "Sem turma")}</span>
          ${entry.photos?.length ? `<span class="tag">Fotos ${entry.photos.length}</span>` : ""}
          ${entry.batchId ? `<span class="tag">Envio em lote</span>` : ""}
        </div>
        <p class="diary-card-body">${escapeHtml(entry.body)}</p>
        ${buildPhotoGrid(entry.photos)}
        <div class="diary-card-footer">
          <small><strong>Professor(a):</strong> ${escapeHtml(entry.authorName || "Equipe escolar")}</small>
          <small><strong>Responsaveis:</strong> ${escapeHtml(responsavelSummary)}</small>
        </div>
        ${actions}
      </article>
    `;
  }

  function mountDiario() {
    async function init(session) {
      if (!session || !window.AgendaGamaDataStore) {
        return;
      }

      const refs = {
        form: document.getElementById("diario-form"),
        feedback: document.getElementById("diario-feedback"),
        targetMode: document.getElementById("diario-target-mode"),
        studentsField: document.getElementById("diario-students-field"),
        studentTurmaFilter: document.getElementById("diario-student-turma-filter"),
        studentTargetsField: document.getElementById("diario-students-target-field"),
        turmasField: document.getElementById("diario-turmas-field"),
        studentTargets: document.getElementById("diario-students-target"),
        turmaTargets: document.getElementById("diario-turmas-target"),
        targetSummary: document.getElementById("diario-target-summary"),
        category: document.getElementById("diario-category"),
        entryDate: document.getElementById("diario-date"),
        title: document.getElementById("diario-title"),
        body: document.getElementById("diario-body"),
        photoInput: document.getElementById("diario-photos"),
        uploadList: document.getElementById("diario-upload-list"),
        uploadHint: document.getElementById("diario-upload-hint"),
        cancel: document.getElementById("diario-cancel"),
        list: document.getElementById("diario-list"),
        empty: document.getElementById("diario-empty"),
        total: document.getElementById("diario-stat-total"),
        today: document.getElementById("diario-stat-today"),
        students: document.getElementById("diario-stat-students"),
        search: document.getElementById("diario-search"),
        filterStudent: document.getElementById("diario-filter-student"),
        filterCategory: document.getElementById("diario-filter-category"),
        accessPanel: document.getElementById("diario-access-panel"),
        editorPanel: document.getElementById("diario-editor-panel"),
        editorTitle: document.getElementById("diario-editor-title"),
        editorDescription: document.getElementById("diario-editor-description")
      };

      if (!refs.list || !refs.form) return;

      const directory = await loadDirectory();
      const actorContext = buildActorContext(session, directory);
      const accessibleStudents = getAccessibleStudents(session, actorContext, directory);
      const accessibleTurmas = getAccessibleTurmas(accessibleStudents, directory);
      const responsavelNamesMap = getResponsavelNamesByStudent(directory);

      const state = {
        entries: await window.AgendaGamaDataStore.list("diario", DIARIO_SEED),
        editingId: null,
        searchTerm: "",
        selectedStudentId: "all",
        selectedCategory: "all",
        selectedStudentTurma: "all",
        pendingPhotos: []
      };

      function setFeedback(message, type) {
        if (!refs.feedback) return;
        refs.feedback.textContent = message || "";
        refs.feedback.className = type ? `feedback ${type}` : "feedback";
      }

      function getStudentChoices() {
        if (state.selectedStudentTurma === "all") {
          return accessibleStudents;
        }

        return accessibleStudents.filter(function (student) {
          return normalizeText(student.turma) === normalizeText(state.selectedStudentTurma);
        });
      }

      function getResolvedTargetStudents() {
        if (state.editingId || refs.targetMode.value === "students") {
          const selectedIds = new Set(getSelectedValues(refs.studentTargets));
          return getStudentChoices().filter(function (student) {
            return selectedIds.has(student.id);
          });
        }

        const selectedTurmas = new Set(getSelectedValues(refs.turmaTargets));
        return accessibleStudents.filter(function (student) {
          return selectedTurmas.has(student.turma);
        });
      }

      function renderTargetSummary() {
        if (!refs.targetSummary) return;

        const selectedStudents = getResolvedTargetStudents();
        const selectedTurmas = getSelectedValues(refs.turmaTargets);

        if (state.editingId) {
          refs.targetSummary.textContent = selectedStudents.length
            ? `Edicao individual para ${selectedStudents[0].nome}.`
            : "Esse registro esta sem um aluno valido no momento.";
          return;
        }

        if (refs.targetMode.value === "students") {
          const turmaPrefix = state.selectedStudentTurma !== "all"
            ? `Turma ${state.selectedStudentTurma}: `
            : "";
          refs.targetSummary.textContent = selectedStudents.length
            ? `${turmaPrefix}${selectedStudents.length} aluno(s) receberao este registro.`
            : turmaPrefix
              ? `Turma ${state.selectedStudentTurma} selecionada. Escolha um ou mais alunos.`
              : "Selecione uma turma e um ou mais alunos para enviar o diario.";
          return;
        }

        refs.targetSummary.textContent = selectedTurmas.length
          ? `${selectedTurmas.length} turma(s) selecionada(s), alcancando ${selectedStudents.length} aluno(s).`
          : "Selecione uma ou mais turmas para enviar o diario completo.";
      }

      function syncTargetFields() {
        const studentMode = state.editingId || refs.targetMode.value === "students";
        refs.studentsField.hidden = !studentMode;
        refs.studentTargetsField.hidden = !studentMode;
        refs.turmasField.hidden = studentMode;
        refs.targetMode.disabled = Boolean(state.editingId);
        refs.studentTargets.required = studentMode;
        refs.turmaTargets.required = !studentMode;
        refs.turmaTargets.disabled = studentMode;
        renderTargetSummary();
      }

      function resetForm(options) {
        const keepFeedback = Boolean(options?.keepFeedback);
        state.editingId = null;
        state.pendingPhotos = [];
        refs.form.reset();
        refs.entryDate.value = getTodayKey();
        refs.targetMode.value = "students";
        refs.category.value = "rotina";
        state.selectedStudentTurma = "all";
        if (refs.studentTurmaFilter) {
          refs.studentTurmaFilter.value = "all";
        }
        renderStudentTargetOptions([]);
        setSelectedValues(refs.studentTargets, []);
        setSelectedValues(refs.turmaTargets, []);
        refs.cancel.hidden = true;
        refs.editorTitle.textContent = canCreateEntries(session) ? "Novo registro do dia" : "Registros do dia";
        if (refs.editorDescription) {
          refs.editorDescription.textContent = "Envie um registro para um aluno especifico, varios alunos ou uma turma inteira.";
        }
        renderUploadPreview();
        syncTargetFields();
        if (!keepFeedback) {
          setFeedback("", "");
        }
      }

      function renderUploadPreview() {
        const photos = state.pendingPhotos || [];
        refs.uploadHint.textContent = photos.length
          ? `${photos.length} foto(s) pronta(s) para envio.`
          : "Voce pode anexar ate 4 fotos por registro.";
        refs.uploadList.hidden = photos.length === 0;
        refs.uploadList.innerHTML = photos.map(function (photo) {
          return `
            <div class="diary-upload-item">
              <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name || "Foto")}">
              <div>
                <strong>${escapeHtml(photo.name || "Foto")}</strong>
                <small>Pronta para envio</small>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-diario-remove-photo="${escapeHtml(photo.id)}">Remover</button>
            </div>
          `;
        }).join("");
      }

      function getVisibleEntries() {
        const accessibleIds = new Set(accessibleStudents.map(function (student) { return student.id; }));
        return sortEntries(state.entries).filter(function (entry) {
          if (!accessibleIds.has(entry.studentId)) return false;

          if (state.selectedStudentId !== "all" && entry.studentId !== state.selectedStudentId) {
            return false;
          }

          if (state.selectedCategory !== "all" && entry.category !== state.selectedCategory) {
            return false;
          }

          const query = normalizeText(state.searchTerm);
          if (!query) return true;

          const haystack = [
            entry.title,
            entry.body,
            entry.studentName,
            entry.turma,
            entry.authorName,
            buildCategoryLabel(entry.category)
          ].map(normalizeText).join(" ");

          return haystack.includes(query);
        });
      }

      function renderStats(visibleEntries) {
        refs.total.textContent = String(visibleEntries.length);
        refs.today.textContent = String(visibleEntries.filter(function (entry) {
          return entry.entryDate === getTodayKey();
        }).length);
        refs.students.textContent = String(accessibleStudents.length);
      }

      function renderAccessPanel() {
        if (!refs.accessPanel) return;

        if (canCreateEntries(session)) {
          refs.accessPanel.innerHTML = `
            <div class="stack-sm">
              <p class="muted">Os registros enviados aqui ficam visiveis no diario do responsavel vinculado ao aluno selecionado.</p>
              <ul class="feature-list">
                <li>Selecione apenas alunos das turmas que voce pode atender.</li>
                <li>Voce pode enviar o mesmo diario para varios alunos de uma vez.</li>
                <li>Tambem e possivel selecionar uma ou mais turmas inteiras para distribuir o registro.</li>
              </ul>
            </div>
          `;
          return;
        }

        refs.accessPanel.innerHTML = `
          <div class="stack-sm">
            <p class="muted">Aqui voce acompanha os registros enviados pela escola sobre a rotina do seu filho.</p>
            <ul class="feature-list">
              <li>Os cards mostram o aluno, a turma e a data do registro.</li>
              <li>Fotos aparecem dentro do proprio diario quando forem enviadas pelo professor.</li>
              <li>Use os filtros para localizar registros antigos mais rapido.</li>
            </ul>
          </div>
        `;
      }

      function render() {
        const visibleEntries = getVisibleEntries();
        refs.empty.hidden = visibleEntries.length > 0;
        refs.list.innerHTML = visibleEntries.map(function (entry) {
          return buildDiaryCard(entry, session, responsavelNamesMap);
        }).join("");
        renderStats(visibleEntries);
      }

      function renderStudentTargetOptions(selectedValues) {
        const choices = getStudentChoices();
        const nextSelectedValues = Array.isArray(selectedValues)
          ? selectedValues
          : getSelectedValues(refs.studentTargets);

        refs.studentTargets.innerHTML = buildStudentOptions(choices);
        setSelectedValues(refs.studentTargets, nextSelectedValues.filter(function (value) {
          return choices.some(function (student) {
            return student.id === value;
          });
        }));
        refs.studentTargets.size = Math.min(Math.max(choices.length, 4), 8);
        refs.studentTargets.disabled = choices.length === 0;
      }

      function populateTargetOptions() {
        refs.studentTurmaFilter.innerHTML = ['<option value="all">Todas as turmas</option>'].concat(accessibleTurmas.map(function (turma) {
          const label = turma.turno ? `${turma.nome} - ${turma.turno}` : turma.nome;
          return `<option value="${escapeHtml(turma.nome)}">${escapeHtml(label)}</option>`;
        })).join("");
        refs.turmaTargets.innerHTML = buildTurmaOptions(accessibleTurmas);
        refs.filterStudent.innerHTML = ['<option value="all">Todos os alunos</option>'].concat(accessibleStudents.map(function (student) {
          return `<option value="${escapeHtml(student.id)}">${escapeHtml(`${student.nome} - ${student.turma || "Sem turma"}`)}</option>`;
        })).join("");

        renderStudentTargetOptions([]);
        refs.turmaTargets.size = Math.min(Math.max(accessibleTurmas.length, 3), 6);
      }

      function openEditor(entry) {
        if (!canCreateEntries(session)) return;

        state.editingId = entry?.id || null;
        refs.editorTitle.textContent = entry ? "Editar registro do dia" : "Novo registro do dia";
        if (refs.editorDescription) {
          refs.editorDescription.textContent = entry
            ? "A edicao continua vinculada apenas ao aluno desse registro."
            : "Envie um registro para um aluno especifico, varios alunos ou uma turma inteira.";
        }
        refs.targetMode.value = "students";
        state.selectedStudentTurma = entry?.turma || "all";
        if (refs.studentTurmaFilter) {
          refs.studentTurmaFilter.value = state.selectedStudentTurma;
        }
        renderStudentTargetOptions(entry?.studentId ? [entry.studentId] : []);
        setSelectedValues(refs.turmaTargets, []);
        refs.category.value = entry?.category || "rotina";
        refs.entryDate.value = entry?.entryDate || getTodayKey();
        refs.title.value = entry?.title || "";
        refs.body.value = entry?.body || "";
        state.pendingPhotos = Array.isArray(entry?.photos) ? entry.photos.map(function (photo) { return ({ ...photo }); }) : [];
        refs.cancel.hidden = !entry;
        renderUploadPreview();
        syncTargetFields();
        setFeedback("", "");
        window.requestAnimationFrame(function () {
          refs.body.focus();
        });
      }

      refs.list.addEventListener("click", async function (event) {
        const editButton = event.target.closest("[data-diario-edit-id]");
        if (editButton) {
          const entry = state.entries.find(function (item) { return item.id === editButton.dataset.diarioEditId; }) || null;
          if (entry) {
            openEditor(entry);
          }
          return;
        }

        const removeButton = event.target.closest("[data-diario-remove-id]");
        if (!removeButton) return;

        state.entries = state.entries.filter(function (item) { return item.id !== removeButton.dataset.diarioRemoveId; });
        await window.AgendaGamaDataStore.remove("diario", removeButton.dataset.diarioRemoveId, DIARIO_SEED);
        if (state.editingId === removeButton.dataset.diarioRemoveId) {
          resetForm();
        }
        render();
      });

      refs.uploadList.addEventListener("click", function (event) {
        const removeButton = event.target.closest("[data-diario-remove-photo]");
        if (!removeButton) return;

        state.pendingPhotos = state.pendingPhotos.filter(function (photo) {
          return photo.id !== removeButton.dataset.diarioRemovePhoto;
        });
        renderUploadPreview();
      });

      refs.photoInput.addEventListener("change", async function () {
        const files = Array.from(refs.photoInput.files || []);
        refs.photoInput.value = "";
        if (!files.length) return;

        if ((state.pendingPhotos.length + files.length) > 4) {
          setFeedback("Envie no maximo 4 fotos por registro.", "error");
        }

        const allowedFiles = files.slice(0, Math.max(0, 4 - state.pendingPhotos.length));
        if (!allowedFiles.length) return;

        try {
          const nextPhotos = [];
          for (const file of allowedFiles) {
            nextPhotos.push(await buildPhotoRecord(file));
          }
          state.pendingPhotos = state.pendingPhotos.concat(nextPhotos);
          renderUploadPreview();
          setFeedback("Foto adicionada ao registro.", "success");
        } catch (error) {
          setFeedback(error instanceof Error ? error.message : "Nao foi possivel anexar a foto.", "error");
        }
      });

      refs.form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const targetStudents = getResolvedTargetStudents();
        if (!targetStudents.length) {
          setFeedback("Selecione pelo menos um aluno ou uma turma com alunos para enviar o diario.", "error");
          return;
        }

        if (state.editingId && targetStudents.length !== 1) {
          setFeedback("Na edicao, mantenha apenas um aluno selecionado para esse registro.", "error");
          return;
        }

        const title = String(refs.title.value || "").trim();
        const body = String(refs.body.value || "").trim();
        if (!title || !body) {
          setFeedback("Preencha o titulo e a mensagem do diario antes de enviar.", "error");
          return;
        }

        const timestamp = new Date().toISOString();
        const selectedTurmas = refs.targetMode.value === "turmas"
          ? getSelectedValues(refs.turmaTargets)
          : Array.from(new Set(targetStudents.map(function (student) { return student.turma; }).filter(Boolean)));
        const editingEntry = state.editingId
          ? state.entries.find(function (item) { return item.id === state.editingId; }) || null
          : null;
        const batchId = state.editingId
          ? (editingEntry?.batchId || null)
          : (targetStudents.length > 1 ? generateId() : null);

        const payloadEntries = targetStudents.map(function (student, index) {
          return {
            id: index === 0 && editingEntry ? editingEntry.id : generateId(),
            batchId: batchId,
            studentId: student.id,
            studentName: student.nome,
            turma: student.turma || "",
            turno: student.turno || "",
            category: refs.category.value || "rotina",
            title: title,
            body: body,
            photos: state.pendingPhotos.map(function (photo) { return ({ ...photo }); }),
            authorName: session.name,
            authorEmail: normalizeEmail(session.email),
            authorRole: session.role,
            targetMode: state.editingId ? "students" : refs.targetMode.value,
            recipientCount: targetStudents.length,
            targetTurmas: selectedTurmas,
            entryDate: refs.entryDate.value || getTodayKey(),
            createdAt: index === 0 && editingEntry
              ? (editingEntry.createdAt || timestamp)
              : timestamp,
            updatedAt: timestamp
          };
        });

        const savedEntries = [];
        for (const entry of payloadEntries) {
          savedEntries.push(await window.AgendaGamaDataStore.save("diario", entry, DIARIO_SEED));
        }

        const savedIds = new Set(savedEntries.map(function (entry) { return entry.id; }));
        state.entries = sortEntries(savedEntries.concat(state.entries.filter(function (entry) {
          return !savedIds.has(entry.id);
        })));

        const successMessage = state.editingId
          ? "Registro atualizado com sucesso."
          : refs.targetMode.value === "turmas"
            ? `Registro enviado para ${targetStudents.length} aluno(s) das turmas selecionadas.`
            : `Registro enviado para ${targetStudents.length} aluno(s) com sucesso.`;

        resetForm({ keepFeedback: true });
        setFeedback(successMessage, "success");
        render();
      });

      refs.cancel.addEventListener("click", function () {
        resetForm();
      });

      refs.targetMode.addEventListener("change", function () {
        syncTargetFields();
      });

      refs.studentTurmaFilter.addEventListener("change", function () {
        state.selectedStudentTurma = refs.studentTurmaFilter.value;
        renderStudentTargetOptions([]);
        renderTargetSummary();
      });

      refs.studentTargets.addEventListener("change", function () {
        renderTargetSummary();
      });

      refs.turmaTargets.addEventListener("change", function () {
        renderTargetSummary();
      });

      refs.search.addEventListener("input", function () {
        state.searchTerm = refs.search.value;
        render();
      });

      refs.filterStudent.addEventListener("change", function () {
        state.selectedStudentId = refs.filterStudent.value;
        render();
      });

      refs.filterCategory.addEventListener("change", function () {
        state.selectedCategory = refs.filterCategory.value;
        render();
      });

      window.addEventListener("storage", function (event) {
        if (event.key !== "agenda-gama-diario") return;
        window.AgendaGamaDataStore.list("diario", DIARIO_SEED).then(function (items) {
          state.entries = items;
          render();
        });
      });

      populateTargetOptions();
      renderAccessPanel();
      renderUploadPreview();
      refs.entryDate.value = getTodayKey();
      refs.category.value = "rotina";
      refs.studentTurmaFilter.value = "all";
      syncTargetFields();

      if (!canCreateEntries(session) && refs.editorPanel) {
        refs.editorPanel.classList.add("diary-editor-readonly");
        refs.editorTitle.textContent = "Como acompanhar o diario";
        if (refs.editorDescription) {
          refs.editorDescription.textContent = "Os registros enviados pelos professores ficam organizados aqui para consulta da familia.";
        }
        refs.form.hidden = true;
      }

      if (!accessibleStudents.length) {
        refs.form.querySelectorAll("input, select, textarea, button").forEach(function (field) {
          if (field.type === "button") return;
          field.disabled = true;
        });
        setFeedback(canCreateEntries(session)
          ? "Nenhum aluno disponivel para voce registrar no diario agora."
          : "Nenhum aluno vinculado para visualizar no diario no momento.", "error");
      }

      render();
    }

    ensureShellContent(function () {
      const currentSession = window.AgendaGamaAuth.getSession();
      if (currentSession) {
        init(currentSession);
        return;
      }

      window.addEventListener("agenda-shell-ready", function handleReady(event) {
        window.removeEventListener("agenda-shell-ready", handleReady);
        init(event.detail?.session || null);
      });
    });
  }

  window.AgendaGamaDiario = {
    mountDiario
  };
})();
