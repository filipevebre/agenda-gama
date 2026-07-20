(function () {
  const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
  const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  });
  const MEAL_LABELS = {
    breakfast: "Café da manhã",
    lunch: "Almoço",
    afternoon_snack: "Café da tarde"
  };

  function ensureShellContent(callback) {
    if (document.getElementById("dashboard-title")) {
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

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function parseDate(value) {
    const date = new Date(String(value || "").length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async function safeList(key) {
    try {
      return await window.AgendaGamaDataStore.list(key, []);
    } catch (error) {
      console.warn(`[Agenda Gama] Não foi possível carregar ${key} no painel.`, error);
      return [];
    }
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }

  function firstName(session) {
    return String(session?.name || "").trim().split(/\s+/)[0] || "";
  }

  function roleCopy(session) {
    if (session?.role === "responsaveis") {
      return {
        pill: "Hoje na família",
        description: "Acompanhe novidades, prazos e a rotina das crianças em um só lugar."
      };
    }
    if (session?.role === "professores") {
      return {
        pill: "Hoje com suas turmas",
        description: "Veja o que precisa de atenção e acesse rapidamente suas rotinas."
      };
    }
    return {
      pill: "Hoje na escola",
      description: "Pendências, publicações e acessos importantes reunidos em uma visão simples."
    };
  }

  function buildStudentCards(students, session) {
    if (!["responsaveis", "professores"].includes(session?.role) || !students.length) return "";
    return students.slice(0, 8).map(function (student) {
      const initial = String(student.nome || "A").trim().slice(0, 1).toUpperCase();
      return `
        <a class="dashboard-student-card" href="perfil-aluno.html?id=${encodeURIComponent(student.id)}">
          <span class="dashboard-student-avatar">${escapeHtml(initial)}</span>
          <span><strong>${escapeHtml(student.nome)}</strong><small>${escapeHtml(student.turma || "Sem turma")}</small></span>
          <span class="dashboard-student-arrow">›</span>
        </a>
      `;
    }).join("");
  }

  function priorityCard(item) {
    return `
      <a class="dashboard-priority-item ${item.urgent ? "is-urgent" : ""}" href="${escapeHtml(item.href)}">
        <span class="dashboard-priority-icon">${escapeHtml(item.icon)}</span>
        <span class="dashboard-priority-copy">
          <small>${escapeHtml(item.label)}</small>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.meta || "")}</span>
        </span>
        <span class="dashboard-priority-arrow">›</span>
      </a>
    `;
  }

  function buildPriorities(data, session) {
    const now = new Date();
    const today = dateKey(now);
    const inSevenDays = new Date(now);
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    const priorities = [];

    data.notices.filter(function (notice) {
      const archived = notice.archiveDate && notice.archiveDate < today;
      return !archived && notice.urgent;
    }).slice(0, 2).forEach(function (notice) {
      priorities.push({
        icon: "!",
        label: "Comunicado urgente",
        title: notice.title,
        meta: notice.summary || "Toque para ler o comunicado.",
        href: `comunicados.html?notice=${encodeURIComponent(notice.id)}`,
        urgent: true,
        rank: 1
      });
    });

    data.diary.filter(function (entry) {
      return entry.entryDate === today;
    }).slice(0, 2).forEach(function (entry) {
      priorities.push({
        icon: "DR",
        label: "Diário de hoje",
        title: entry.title || entry.studentName,
        meta: `${entry.studentName || "Aluno"} · ${entry.turma || "Sem turma"}`,
        href: `diario.html?entry=${encodeURIComponent(entry.id)}`,
        rank: 2
      });
    });

    data.activities.filter(function (activity) {
      const dueDate = parseDate(activity.dueAt);
      return activity.status === "published" && dueDate && dueDate >= now && dueDate <= inSevenDays;
    }).slice(0, 2).forEach(function (activity) {
      priorities.push({
        icon: "AT",
        label: "Atividade próxima",
        title: activity.title,
        meta: activity.dueAt ? `Prazo ${SHORT_DATE_FORMATTER.format(parseDate(activity.dueAt))}` : activity.subject,
        href: "atividades.html",
        rank: 3
      });
    });

    if (session?.role === "responsaveis") {
      const answeredFormIds = new Set(data.formResponses.map(function (response) { return response.formId; }));
      data.forms.filter(function (form) {
        const closesAt = parseDate(form.closesAt);
        return form.status === "published" && !answeredFormIds.has(form.id) && (!closesAt || closesAt >= now);
      }).slice(0, 2).forEach(function (form) {
        priorities.push({
          icon: "FO",
          label: "Resposta pendente",
          title: form.title,
          meta: form.closesAt ? `Responda até ${SHORT_DATE_FORMATTER.format(parseDate(form.closesAt))}` : "Formulário disponível",
          href: "formularios.html",
          rank: 2
        });
      });
    } else {
      data.forms.concat(data.activities).concat(data.notices).filter(function (item) {
        return item.status === "draft" || (Object.prototype.hasOwnProperty.call(item, "urgent") && !item.createdAt);
      }).slice(0, 2).forEach(function (item) {
        priorities.push({
          icon: "RP",
          label: "Rascunho",
          title: item.title || "Publicação não concluída",
          meta: "Revise e publique quando estiver pronto.",
          href: Object.prototype.hasOwnProperty.call(item, "questions") ? "formularios.html" : Object.prototype.hasOwnProperty.call(item, "subject") ? "atividades.html" : "comunicados.html",
          rank: 4
        });
      });
    }

    return priorities.sort(function (left, right) { return left.rank - right.rank; }).slice(0, 6);
  }

  function renderMenu(records, students) {
    const root = document.getElementById("dashboard-menu-today");
    const today = dateKey(new Date());
    const weekday = new Date().getDay();
    const studentTurmas = new Set(students.map(function (student) { return normalizeText(student.turma); }).filter(Boolean));
    const menu = records.find(function (record) {
      const targetTurmas = Array.isArray(record.targetTurmas) ? record.targetTurmas : [];
      const targetMatches = !targetTurmas.length || !studentTurmas.size || targetTurmas.some(function (turma) {
        return studentTurmas.has(normalizeText(turma));
      });
      return record.status === "published"
        && Number(record.weekday) === weekday
        && record.validFrom <= today
        && record.validUntil >= today
        && targetMatches;
    });

    if (!menu || weekday === 0 || weekday === 6) {
      root.innerHTML = '<p class="dashboard-calm-state">Nenhum cardápio informado para hoje.</p>';
      return;
    }

    const mealMap = new Map((menu.meals || []).map(function (meal) { return [meal.type, meal.description]; }));
    root.innerHTML = Object.keys(MEAL_LABELS).map(function (type) {
      return `
        <div class="dashboard-meal-row">
          <span>${escapeHtml(MEAL_LABELS[type].slice(0, 1))}</span>
          <div><strong>${escapeHtml(MEAL_LABELS[type])}</strong><small>${escapeHtml(mealMap.get(type) || "Não informado")}</small></div>
        </div>
      `;
    }).join("");
  }

  function calculateCounts(data, session) {
    const today = dateKey(new Date());
    const todayDiary = data.diary.filter(function (entry) { return entry.entryDate === today; }).length;
    const todayActivities = data.activities.filter(function (activity) { return dateKey(activity.dueAt) === today; }).length;
    const urgentNotices = data.notices.filter(function (notice) {
      return notice.urgent && (!notice.archiveDate || notice.archiveDate >= today);
    }).length;
    let pending = 0;
    if (session?.role === "responsaveis") {
      const answered = new Set(data.formResponses.map(function (response) { return response.formId; }));
      pending = data.forms.filter(function (form) {
        const closesAt = parseDate(form.closesAt);
        return form.status === "published" && !answered.has(form.id) && (!closesAt || closesAt >= new Date());
      }).length;
    } else {
      pending = data.forms.concat(data.activities).filter(function (item) { return item.status === "draft"; }).length;
    }
    return { today: todayDiary + todayActivities + urgentNotices, pending: pending };
  }

  async function renderDashboard(session) {
    if (!session || !window.AgendaGamaDataStore) return;
    const [students, diary, notices, activities, forms, formResponses, menus] = await Promise.all([
      safeList("alunos"),
      safeList("diario"),
      safeList("notices"),
      safeList("activities"),
      safeList("forms"),
      safeList("formResponses"),
      safeList("menus")
    ]);
    const data = { diary, notices, activities, forms, formResponses, menus };
    const copy = roleCopy(session);
    const name = firstName(session);

    document.getElementById("dashboard-pill").textContent = copy.pill;
    document.getElementById("dashboard-title").textContent = `${greeting()}${name ? `, ${name}` : ""}`;
    document.getElementById("dashboard-description").textContent = copy.description;
    document.getElementById("dashboard-date").textContent = DATE_FORMATTER.format(new Date());

    const studentSection = document.getElementById("dashboard-students");
    const studentMarkup = buildStudentCards(students, session);
    studentSection.hidden = !studentMarkup;
    document.getElementById("dashboard-student-list").innerHTML = studentMarkup;
    document.getElementById("dashboard-students-title").textContent = session.role === "responsaveis" ? "Seus filhos" : "Alunos das suas turmas";

    const counts = calculateCounts(data, session);
    document.getElementById("dashboard-stat-today").textContent = counts.today;
    document.getElementById("dashboard-stat-pending").textContent = counts.pending;
    document.getElementById("dashboard-stat-context").textContent = students.length;
    if (session.role === "professores") {
      document.getElementById("dashboard-stat-context-label").textContent = "Alunos das turmas";
    } else if (session.role === "responsaveis") {
      document.getElementById("dashboard-stat-context-label").textContent = "Crianças vinculadas";
    }

    const priorities = buildPriorities(data, session);
    document.getElementById("dashboard-priority-list").innerHTML = priorities.map(priorityCard).join("");
    document.getElementById("dashboard-priority-empty").hidden = Boolean(priorities.length);
    renderMenu(menus, students);

    document.querySelectorAll(".dashboard-staff-shortcut").forEach(function (item) {
      item.hidden = !["administrador", "funcionarios"].includes(session.role);
    });
  }

  function mountDashboard() {
    ensureShellContent(function (shellSession) {
      const session = shellSession || window.AgendaGamaAuth?.getSession?.() || null;
      renderDashboard(session);
    });
  }

  window.AgendaGamaDashboard = { mountDashboard: mountDashboard };
})();
