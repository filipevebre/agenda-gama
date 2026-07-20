(function () {
  const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  function ensureShellContent(callback) {
    if (document.getElementById("student-profile-feedback")) {
      callback();
      return;
    }
    window.addEventListener("agenda-shell-ready", function handleReady(event) {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback(event.detail?.session || null);
    });
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
      .trim()
      .toLowerCase();
  }

  function parseDate(value) {
    const date = new Date(String(value || "").length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = parseDate(value);
    return date ? DATE_FORMATTER.format(date) : "Sem data";
  }

  function truncate(value, length) {
    const text = String(value || "").trim();
    return text.length > length ? `${text.slice(0, length).trim()}…` : text;
  }

  async function safeList(key) {
    try {
      return await window.AgendaGamaDataStore.list(key, []);
    } catch (error) {
      console.warn(`[Agenda Gama] Não foi possível carregar ${key} no perfil do aluno.`, error);
      return [];
    }
  }

  function matchesStudent(record, student) {
    if (record.studentId && student.id) return String(record.studentId) === String(student.id);
    const recordName = record.studentName || record.aluno;
    return normalizeText(recordName) === normalizeText(student.nome);
  }

  function matchesTurma(targetTurmas, turma) {
    const targets = Array.isArray(targetTurmas) ? targetTurmas.filter(Boolean) : [];
    if (!targets.length) return true;
    return targets.some(function (target) { return normalizeText(target) === normalizeText(turma); });
  }

  function emptyMarkup(message) {
    return `<p class="student-profile-empty">${escapeHtml(message)}</p>`;
  }

  function diaryMarkup(entries) {
    if (!entries.length) return emptyMarkup("Nenhum registro no diário deste aluno.");
    return entries.slice(0, 4).map(function (entry) {
      return `
        <a class="student-profile-feed-item" href="diario.html?entry=${encodeURIComponent(entry.id)}">
          <span class="student-profile-feed-date">${escapeHtml(formatDate(entry.entryDate || entry.createdAt))}</span>
          <strong>${escapeHtml(entry.title || "Registro do dia")}</strong>
          <p>${escapeHtml(truncate(entry.body, 120) || "Abra para consultar o registro completo.")}</p>
        </a>
      `;
    }).join("");
  }

  function activityMarkup(activities, completions, student) {
    if (!activities.length) return emptyMarkup("Nenhuma atividade publicada para esta turma.");
    return activities.slice(0, 4).map(function (activity) {
      const completed = completions.some(function (completion) {
        return completion.activityId === activity.id && matchesStudent(completion, student);
      });
      return `
        <a class="student-profile-feed-item" href="atividades.html">
          <span class="student-profile-feed-status ${completed ? "is-done" : ""}">${completed ? "Concluída" : "Pendente"}</span>
          <strong>${escapeHtml(activity.title)}</strong>
          <p>${escapeHtml(activity.subject || "Atividade escolar")}${activity.dueAt ? ` · prazo ${escapeHtml(formatDate(activity.dueAt))}` : ""}</p>
        </a>
      `;
    }).join("");
  }

  function formMarkup(forms, responses, student) {
    if (!forms.length) return emptyMarkup("Nenhum formulário disponível para esta turma.");
    return forms.slice(0, 4).map(function (form) {
      const answered = responses.some(function (response) {
        return response.formId === form.id && matchesStudent(response, student);
      });
      return `
        <a class="student-profile-feed-item" href="formularios.html">
          <span class="student-profile-feed-status ${answered ? "is-done" : ""}">${answered ? "Respondido" : "Pendente"}</span>
          <strong>${escapeHtml(form.title)}</strong>
          <p>${escapeHtml(form.description || "Formulário escolar")}${form.closesAt ? ` · até ${escapeHtml(formatDate(form.closesAt))}` : ""}</p>
        </a>
      `;
    }).join("");
  }

  function guardianMarkup(guardians) {
    if (!guardians.length) return emptyMarkup("Nenhum responsável vinculado.");
    return guardians.map(function (guardian) {
      const initial = String(guardian.nome || "R").trim().slice(0, 1).toUpperCase();
      return `
        <div class="student-profile-contact">
          <span>${escapeHtml(initial)}</span>
          <div><strong>${escapeHtml(guardian.nome)}</strong><small>${escapeHtml(guardian.parentesco || guardian.vinculo || "Responsável")}</small><small>${escapeHtml(guardian.email || "")}</small></div>
        </div>
      `;
    }).join("");
  }

  function noticeMarkup(notices) {
    if (!notices.length) return emptyMarkup("Nenhum comunicado recente para esta turma.");
    return notices.slice(0, 3).map(function (notice) {
      return `
        <a class="student-profile-feed-item ${notice.urgent ? "is-urgent" : ""}" href="comunicados.html?notice=${encodeURIComponent(notice.id)}">
          <span class="student-profile-feed-date">${notice.urgent ? "Urgente" : escapeHtml(formatDate(notice.createdAt))}</span>
          <strong>${escapeHtml(notice.title)}</strong>
          <p>${escapeHtml(truncate(notice.summary || notice.body, 90))}</p>
        </a>
      `;
    }).join("");
  }

  async function init(session) {
    if (!session || !window.AgendaGamaDataStore) return;
    const feedback = document.getElementById("student-profile-feedback");
    feedback.textContent = "Carregando perfil do aluno...";

    const [students, guardians, diary, activities, completions, forms, responses, notices] = await Promise.all([
      safeList("alunos"),
      safeList("responsaveis"),
      safeList("diario"),
      safeList("activities"),
      safeList("activityCompletions"),
      safeList("forms"),
      safeList("formResponses"),
      safeList("notices")
    ]);

    const requestedId = new URLSearchParams(window.location.search).get("id");
    const student = students.find(function (item) { return String(item.id) === String(requestedId); }) || students[0] || null;
    if (!student) {
      feedback.textContent = "Nenhum aluno disponível para este perfil.";
      feedback.className = "feedback error";
      return;
    }

    const studentDiary = diary.filter(function (entry) { return matchesStudent(entry, student); }).sort(function (left, right) {
      return new Date(right.entryDate || right.createdAt || 0) - new Date(left.entryDate || left.createdAt || 0);
    });
    const studentActivities = activities.filter(function (activity) {
      return activity.status === "published" && matchesTurma(activity.targetTurmas, student.turma);
    }).sort(function (left, right) { return new Date(right.dueAt || 0) - new Date(left.dueAt || 0); });
    const studentForms = forms.filter(function (form) {
      return form.status === "published" && matchesTurma(form.targetTurmas, student.turma);
    }).sort(function (left, right) { return new Date(right.createdAt || 0) - new Date(left.createdAt || 0); });
    const studentGuardians = guardians.filter(function (guardian) {
      return (guardian.aluno_id && String(guardian.aluno_id) === String(student.id))
        || normalizeText(guardian.aluno) === normalizeText(student.nome);
    });
    const today = new Date().toISOString().slice(0, 10);
    const studentNotices = notices.filter(function (notice) {
      return matchesTurma(notice.targetTurmas, student.turma) && (!notice.archiveDate || notice.archiveDate >= today);
    }).sort(function (left, right) {
      if (Boolean(left.urgent) !== Boolean(right.urgent)) return left.urgent ? -1 : 1;
      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    });

    const switchField = document.getElementById("student-profile-switch-field");
    const switchSelect = document.getElementById("student-profile-switch");
    switchField.hidden = students.length < 2;
    switchSelect.innerHTML = students.map(function (item) {
      return `<option value="${escapeHtml(item.id)}" ${item.id === student.id ? "selected" : ""}>${escapeHtml(item.nome)} · ${escapeHtml(item.turma || "Sem turma")}</option>`;
    }).join("");
    switchSelect.addEventListener("change", function () {
      window.location.href = `perfil-aluno.html?id=${encodeURIComponent(switchSelect.value)}`;
    });

    document.getElementById("student-profile-avatar").textContent = String(student.nome || "A").trim().slice(0, 1).toUpperCase();
    document.getElementById("student-profile-name").textContent = student.nome;
    document.getElementById("student-profile-tags").innerHTML = [student.turma, student.turno, student.matricula ? `Matrícula ${student.matricula}` : ""].filter(Boolean).map(function (tag) {
      return `<span>${escapeHtml(tag)}</span>`;
    }).join("");

    const editButton = document.getElementById("student-profile-edit");
    editButton.hidden = !["administrador", "funcionarios"].includes(session.role);
    editButton.href = `organizacao/cadastro-alunos.html?id=${encodeURIComponent(student.id)}`;

    const completedActivities = completions.filter(function (completion) { return matchesStudent(completion, student); });
    const answeredForms = responses.filter(function (response) { return matchesStudent(response, student); });
    document.getElementById("student-profile-diary-count").textContent = studentDiary.length;
    document.getElementById("student-profile-activity-count").textContent = studentActivities.length;
    document.getElementById("student-profile-activity-note").textContent = `${completedActivities.length} concluída(s)`;
    document.getElementById("student-profile-form-count").textContent = studentForms.length;
    document.getElementById("student-profile-form-note").textContent = `${answeredForms.length} respondido(s)`;

    document.getElementById("student-profile-diary").innerHTML = diaryMarkup(studentDiary);
    document.getElementById("student-profile-activities").innerHTML = activityMarkup(studentActivities, completions, student);
    document.getElementById("student-profile-forms").innerHTML = formMarkup(studentForms, responses, student);
    document.getElementById("student-profile-guardians").innerHTML = guardianMarkup(studentGuardians);
    document.getElementById("student-profile-notices").innerHTML = noticeMarkup(studentNotices);

    document.getElementById("student-profile-hero").hidden = false;
    document.getElementById("student-profile-content").hidden = false;
    feedback.textContent = "";
    feedback.className = "feedback";
  }

  function mount() {
    ensureShellContent(function (shellSession) {
      init(shellSession || window.AgendaGamaAuth?.getSession?.() || null);
    });
  }

  window.AgendaGamaStudentProfile = { mount: mount };
})();
