(function () {
  const SIDEBAR_STATE_KEY = "agenda-gama-sidebar-collapsed";
  const NOTIFICATIONS_KEY = "agenda-gama-notifications";
  const THREAD_VIEW_KEY = "agenda-gama-message-thread-view";
  const THREAD_STATE_KEY = "agenda-gama-message-thread-state";
  const MESSAGE_PREFIX = "AGAMA_MESSAGE::";
  const NOTIFICATION_REFRESH_MS = 12000;
  const VIRTUAL_CHANNELS = [
    { id: "setor-secretaria", nome: "Secretaria", channelType: "secretaria", publico: "Atendimento geral", descricao: "Atendimento administrativo e vida escolar." },
    { id: "setor-coordenacao", nome: "Coordenacao", channelType: "coordenacao", publico: "Pedagogico", descricao: "Orientacao pedagogica e acompanhamento escolar." },
    { id: "setor-financeiro", nome: "Financeiro", channelType: "financeiro", publico: "Atendimento", descricao: "Mensalidades, boletos e combinados financeiros." },
    { id: "setor-professor", nome: "Professor", channelType: "professor", publico: "Sala de aula", descricao: "Contato com professor ou equipe docente." }
  ];
  let activeShellSession = null;
  let activeNotificationElements = null;
  let activeToastHost = null;
  let activeNotificationTimer = null;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function getInitials(name) {
    return String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function slugify(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function readNotifications() {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function writeNotifications(items) {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items || []));
  }

  function getNotificationSessionKey(session) {
    return `${session.role}:${normalizeEmail(session.email)}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function generateNotificationId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatNotificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function getCommunicationHref(threadKey) {
    const baseHref = isOrganizationPage() ? "../comunicacao.html" : "comunicacao.html";
    if (!threadKey) return baseHref;
    return `${baseHref}?thread=${encodeURIComponent(threadKey)}`;
  }

  function listSessionNotifications(session) {
    const sessionKey = getNotificationSessionKey(session);
    return readNotifications()
      .filter((item) => item.sessionKey === sessionKey)
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  }

  function dispatchNotificationsUpdated() {
    window.dispatchEvent(new CustomEvent("agenda-notifications-updated"));
  }

  function markNotificationRead(notificationId) {
    if (!activeShellSession || !notificationId) return;
    const notifications = readNotifications();
    const nextNotifications = notifications.map((item) => {
      if (item.id !== notificationId) return item;
      return item.readAt ? item : { ...item, readAt: new Date().toISOString() };
    });
    writeNotifications(nextNotifications);
    dispatchNotificationsUpdated();
  }

  function markAllNotificationsRead() {
    if (!activeShellSession) return;
    const sessionKey = getNotificationSessionKey(activeShellSession);
    const timestamp = new Date().toISOString();
    const nextNotifications = readNotifications().map((item) => {
      if (item.sessionKey !== sessionKey || item.readAt) return item;
      return { ...item, readAt: timestamp };
    });
    writeNotifications(nextNotifications);
    dispatchNotificationsUpdated();
  }

  function closeNotificationPanel() {
    if (!activeNotificationElements?.panel || !activeNotificationElements?.toggle) return;
    activeNotificationElements.panel.hidden = true;
    activeNotificationElements.toggle.setAttribute("aria-expanded", "false");
  }

  function renderNotifications() {
    if (!activeShellSession || !activeNotificationElements) return;

    const notifications = listSessionNotifications(activeShellSession);
    const unreadCount = notifications.filter((item) => !item.readAt).length;
    const { badge, list, empty, markAll } = activeNotificationElements;

    badge.hidden = unreadCount === 0;
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    empty.hidden = notifications.length > 0;
    markAll.disabled = unreadCount === 0;

    list.innerHTML = notifications.map((item) => {
      return `
        <button type="button" class="notification-item ${item.readAt ? "" : "is-unread"}" data-notification-id="${item.id}" data-notification-href="${item.href || ""}">
          <span class="notification-item-icon">${item.kind === "communication-approval" ? "AP" : "MS"}</span>
          <span class="notification-item-copy">
            <strong>${item.title}</strong>
            <span>${item.body}</span>
            <small>${formatNotificationTime(item.createdAt)}</small>
          </span>
        </button>
      `;
    }).join("");
  }

  function showNotificationToast(notification) {
    if (!activeToastHost || !notification || !activeShellSession) return;

    const toast = document.createElement("button");
    toast.type = "button";
    toast.className = "notification-toast";
    toast.innerHTML = `
      <strong>${notification.title}</strong>
      <span>${notification.body}</span>
    `;

    toast.addEventListener("click", function () {
      markNotificationRead(notification.id);
      if (notification.href) {
        window.location.href = notification.href;
      } else {
        closeNotificationPanel();
      }
    });

    activeToastHost.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.add("is-visible");
    }, 20);
    window.setTimeout(function () {
      toast.classList.remove("is-visible");
      window.setTimeout(function () {
        toast.remove();
      }, 220);
    }, 4200);
  }

  function syncCommunicationNotifications(session, alerts) {
    if (!session) return;

    const sessionKey = getNotificationSessionKey(session);
    const previousNotifications = readNotifications();
    const currentSessionNotifications = previousNotifications.filter((item) => item.sessionKey === sessionKey);
    const otherNotifications = previousNotifications.filter((item) => item.sessionKey !== sessionKey);
    const activeAlerts = (alerts || []).filter(Boolean);
    const activeKeys = new Set(activeAlerts.map((item) => item.dedupeKey));
    const preservedSessionNotifications = currentSessionNotifications.filter((item) => !String(item.kind || "").startsWith("communication-") || activeKeys.has(item.dedupeKey));
    const toastQueue = [];

    activeAlerts.forEach((alert) => {
      const existing = currentSessionNotifications.find((item) => item.dedupeKey === alert.dedupeKey) || null;
      const href = alert.href || getCommunicationHref(alert.threadKey);

      if (!existing) {
        const created = {
          id: generateNotificationId(),
          sessionKey: sessionKey,
          dedupeKey: alert.dedupeKey,
          kind: alert.kind || "communication-thread",
          title: alert.title,
          body: alert.body,
          href: href,
          createdAt: alert.createdAt || new Date().toISOString(),
          sourceStamp: String(alert.sourceStamp || alert.createdAt || ""),
          readAt: null
        };
        preservedSessionNotifications.push(created);
        toastQueue.push(created);
        return;
      }

      const sourceStamp = String(alert.sourceStamp || alert.createdAt || "");
      const isUpdated = existing.sourceStamp !== sourceStamp;
      const nextNotification = {
        ...existing,
        kind: alert.kind || existing.kind,
        title: alert.title,
        body: alert.body,
        href: href,
        createdAt: alert.createdAt || existing.createdAt,
        sourceStamp: sourceStamp,
        readAt: isUpdated ? null : existing.readAt
      };

      const targetIndex = preservedSessionNotifications.findIndex((item) => item.id === existing.id);
      if (targetIndex >= 0) {
        preservedSessionNotifications[targetIndex] = nextNotification;
      } else {
        preservedSessionNotifications.push(nextNotification);
      }

      if (isUpdated) {
        toastQueue.push(nextNotification);
      }
    });

    const nextNotifications = otherNotifications.concat(preservedSessionNotifications);
    writeNotifications(nextNotifications);
    dispatchNotificationsUpdated();

    if (activeShellSession && getNotificationSessionKey(activeShellSession) === sessionKey) {
      toastQueue.slice(0, 2).forEach(showNotificationToast);
    }
  }

  function parseEnvelope(content) {
    const raw = String(content || "");
    if (!raw.startsWith(MESSAGE_PREFIX)) {
      return {
        text: raw,
        internalOnly: false,
        attachments: [],
        placeholder: false,
        thread: null
      };
    }

    try {
      return JSON.parse(raw.slice(MESSAGE_PREFIX.length));
    } catch (error) {
      return {
        text: raw,
        internalOnly: false,
        attachments: [],
        placeholder: false,
        thread: null
      };
    }
  }

  function findStudentByName(directory, name) {
    return (directory.alunos || []).find((item) => normalizeText(item.nome) === normalizeText(name)) || null;
  }

  function buildMaps(directory) {
    return {
      studentsById: new Map((directory.alunos || []).map((item) => [item.id, item])),
      responsaveisByEmail: new Map((directory.responsaveis || []).map((item) => [normalizeEmail(item.email), item])),
      responsaveisByName: new Map((directory.responsaveis || []).map((item) => [normalizeText(item.nome), item]))
    };
  }

  function inferSectorFromMessage(message, senderRecord) {
    if (message.sender_role === "professores") return "Professor";
    if (message.recipient_type === "interno") return "Coordenacao";
    if (senderRecord?.setor) return senderRecord.setor;
    return "Secretaria";
  }

  function getAllChannels(storedChannels) {
    const merged = [...(storedChannels || [])];
    VIRTUAL_CHANNELS.forEach((channel) => {
      if (!merged.some((item) => item.id === channel.id)) {
        merged.push(channel);
      }
    });
    return merged;
  }

  function inferLegacyThread(message, directory, channels, maps) {
    const channel = channels.find((item) => item.id === message.canal_id || normalizeText(item.nome) === normalizeText(message.canal_nome)) || null;
    const senderRecord = maps.responsaveisByEmail.get(normalizeEmail(message.sender_email))
      || maps.responsaveisByName.get(normalizeText(message.sender_name))
      || null;
    const targetRecord = (Array.isArray(message.recipients) ? message.recipients : [])
      .map((token) => maps.responsaveisByEmail.get(normalizeEmail(token)) || maps.responsaveisByName.get(normalizeText(token)) || null)
      .find(Boolean) || senderRecord;

    if (message.recipient_type === "turmas") {
      const turma = channel?.publico || message.recipients?.[0] || "Turma";
      return {
        key: `broadcast:${message.canal_id || slugify(message.canal_nome || turma)}`,
        type: "broadcast",
        channelId: channel?.id || null,
        channelName: channel?.nome || message.canal_nome || turma,
        channelType: "turma",
        sector: "Secretaria",
        turma: turma,
        subject: message.subject || "Comunicados gerais"
      };
    }

    const student = targetRecord?.aluno_id ? maps.studentsById.get(targetRecord.aluno_id) : findStudentByName(directory, targetRecord?.aluno || "");
    const sector = inferSectorFromMessage(message, senderRecord);

    return {
      key: `family:${message.canal_id || slugify(message.canal_nome || sector)}:${targetRecord?.id || normalizeEmail(targetRecord?.email || message.sender_email)}:${slugify(sector) || "secretaria"}`,
      type: "family",
      channelId: channel?.id || null,
      channelName: channel?.nome || message.canal_nome || sector,
      channelType: channel?.channelType || "turma",
      sector: sector,
      responsibleId: targetRecord?.id || null,
      responsibleName: targetRecord?.nome || message.sender_name,
      responsibleEmail: targetRecord?.email || message.sender_email,
      studentId: student?.id || targetRecord?.aluno_id || null,
      studentName: student?.nome || targetRecord?.aluno || "",
      turma: student?.turma || channel?.publico || "",
      subject: message.subject || "Atendimento escolar"
    };
  }

  function parseStoredMessage(message, directory, channels, maps) {
    const envelope = parseEnvelope(message?.content || "");
    return {
      ...message,
      workflowStatus: String(message?.status || "sent").trim().toLowerCase(),
      parsed: {
        text: envelope.text || "",
        internalOnly: Boolean(envelope.internalOnly),
        attachments: Array.isArray(envelope.attachments) ? envelope.attachments : [],
        placeholder: Boolean(envelope.placeholder),
        thread: envelope.thread || inferLegacyThread(message, directory, channels, maps)
      }
    };
  }

  function getActorContext(session, directory) {
    const professor = (directory.professores || []).find((item) => normalizeEmail(item.email) === normalizeEmail(session.email) || normalizeText(item.nome) === normalizeText(session.name)) || null;
    const funcionario = (directory.equipe || []).find((item) => normalizeEmail(item.email) === normalizeEmail(session.email) || normalizeText(item.nome) === normalizeText(session.name)) || null;
    const responsavelRecords = (directory.responsaveis || []).filter((item) => normalizeEmail(item.email) === normalizeEmail(session.email));
    const responsavelTurmas = new Set();
    const professorTurmas = new Set();

    if (professor?.turmas) {
      String(professor.turmas).split(",").map((item) => item.trim()).filter(Boolean).forEach((item) => professorTurmas.add(item));
    } else if (professor?.turno) {
      (directory.turmas || []).filter((turma) => normalizeText(turma.turno) === normalizeText(professor.turno)).forEach((turma) => professorTurmas.add(turma.nome));
    }

    const funcionarioSectors = new Set();
    if (funcionario?.setor) funcionarioSectors.add(funcionario.setor);
    if (funcionario?.cargo) funcionarioSectors.add(funcionario.cargo);
    if (session.role === "funcionarios" && !funcionarioSectors.size) {
      funcionarioSectors.add("Secretaria");
    }

    responsavelRecords.forEach((item) => {
      const student = item.aluno_id
        ? (directory.alunos || []).find((candidate) => candidate.id === item.aluno_id)
        : findStudentByName(directory, item.aluno);
      if (student?.turma) {
        responsavelTurmas.add(student.turma);
      }
    });

    return {
      professorTurmas,
      funcionarioSectors,
      responsavelTurmas
    };
  }

  function canViewThread(thread, session, actorContext, messages) {
    if (session.role === "administrador" || session.canApprove) return true;

    if (session.role === "responsaveis") {
      if (thread.type === "broadcast") {
        return actorContext.responsavelTurmas.has(thread.turma);
      }
      return normalizeEmail(thread.responsibleEmail) === normalizeEmail(session.email);
    }

    if (session.role === "professores") {
      return actorContext.professorTurmas.has(thread.turma)
        || (messages || []).some((message) => normalizeEmail(message.sender_email) === normalizeEmail(session.email));
    }

    if (session.role === "funcionarios") {
      if (!actorContext.funcionarioSectors.size) return true;
      if (thread.type === "broadcast") return true;
      return [...actorContext.funcionarioSectors].some((sector) => {
        return normalizeText(thread.sector).includes(normalizeText(sector)) || normalizeText(sector).includes(normalizeText(thread.sector));
      });
    }

    return false;
  }

  function getSeenAt(session, threadKey) {
    const state = readJson(THREAD_VIEW_KEY, {});
    return state[getNotificationSessionKey(session)]?.[threadKey] || "";
  }

  function getThreadTitle(thread) {
    return thread.type === "broadcast" ? thread.channelName : (thread.responsibleName || thread.channelName);
  }

  function getThreadPreview(thread) {
    if (!thread.lastMessage || thread.lastMessage.parsed?.placeholder) {
      return "Conversa iniciada. Abra o chat para enviar a primeira mensagem.";
    }
    return thread.lastMessage.parsed?.text || "Sem mensagens registradas.";
  }

  async function buildCommunicationAlertsForSession(session) {
    if (!window.AgendaGamaDataStore) return [];

    const [turmas, alunos, responsaveis, professores, equipe, storedChannels, storedMessages] = await Promise.all([
      window.AgendaGamaDataStore.list("turmas", []),
      window.AgendaGamaDataStore.list("alunos", []),
      window.AgendaGamaDataStore.list("responsaveis", []),
      window.AgendaGamaDataStore.list("professores", []),
      window.AgendaGamaDataStore.list("equipe", []),
      window.AgendaGamaDataStore.list("channels", []),
      window.AgendaGamaDataStore.list("messages", [])
    ]);

    const directory = { turmas, alunos, responsaveis, professores, equipe };
    const channels = getAllChannels(storedChannels);
    const maps = buildMaps(directory);
    const actorContext = getActorContext(session, directory);
    const threadState = readJson(THREAD_STATE_KEY, {});
    const grouped = new Map();

    storedMessages
      .map((message) => parseStoredMessage(message, directory, channels, maps))
      .forEach((message) => {
        const thread = message.parsed.thread;
        if (!thread?.key) return;
        if (!grouped.has(thread.key)) {
          grouped.set(thread.key, {
            ...thread,
            messages: [],
            local: threadState[thread.key] || {}
          });
        }
        grouped.get(thread.key).messages.push(message);
      });

    return Array.from(grouped.values()).flatMap((thread) => {
      const sortedMessages = [...thread.messages].sort((left, right) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime());
      if (!canViewThread(thread, session, actorContext, sortedMessages)) return [];
      if (thread.local.archived) return [];

      const visibleMessages = sortedMessages.filter((message) => {
        if (message.parsed.placeholder) return false;
        if (message.parsed.internalOnly) return false;
        if (session.role === "responsaveis" && message.workflowStatus !== "sent" && normalizeEmail(message.sender_email) !== normalizeEmail(session.email)) return false;
        return true;
      });

      const lastMessage = visibleMessages[visibleMessages.length - 1] || sortedMessages[sortedMessages.length - 1] || null;
      const seenAt = new Date(getSeenAt(session, thread.key) || 0).getTime();
      const unreadCount = visibleMessages.filter((message) => {
        return normalizeEmail(message.sender_email) !== normalizeEmail(session.email)
          && new Date(message.created_at || 0).getTime() > seenAt;
      }).length;
      const pendingApprovalCount = sortedMessages.filter((message) => message.workflowStatus === "pending_approval").length;
      const alerts = [];

      if (unreadCount > 0 && lastMessage) {
        alerts.push({
          kind: "communication-thread",
          dedupeKey: `thread:${thread.key}`,
          threadKey: thread.key,
          title: session.role === "responsaveis"
            ? (thread.type === "broadcast" ? `Novo aviso em ${thread.channelName}` : "Nova resposta da escola")
            : `Nova mensagem em ${getThreadTitle(thread)}`,
          body: `${thread.studentName || thread.turma || thread.sector || "Atendimento"} • ${getThreadPreview({ ...thread, lastMessage })}`,
          createdAt: lastMessage.created_at || new Date().toISOString(),
          sourceStamp: lastMessage.created_at || `${thread.key}:${unreadCount}`
        });
      }

      if (session.canApprove && pendingApprovalCount > 0) {
        alerts.push({
          kind: "communication-approval",
          dedupeKey: `approval:${thread.key}`,
          threadKey: thread.key,
          title: "Mensagem aguardando aprovacao",
          body: `${pendingApprovalCount} mensagem(ns) pendente(s) em ${getThreadTitle(thread)}.`,
          createdAt: lastMessage?.created_at || new Date().toISOString(),
          sourceStamp: `${pendingApprovalCount}:${lastMessage?.created_at || thread.key}`
        });
      }

      return alerts;
    });
  }

  async function refreshShellNotifications() {
    if (!activeShellSession) return;
    try {
      const alerts = await buildCommunicationAlertsForSession(activeShellSession);
      syncCommunicationNotifications(activeShellSession, alerts);
    } catch (error) {
      renderNotifications();
    }
  }

  function isOrganizationPage() {
    return window.location.href.includes("/app/organizacao/");
  }

  function getNavItems() {
    const inOrganization = isOrganizationPage();
    const dashboardHref = inOrganization ? "../dashboard.html" : "dashboard.html";
    const organizationPrefix = inOrganization ? "" : "organizacao/";
    const cadastroPrefix = `${organizationPrefix}cadastro-`;

    return [
      {
        section: "Geral",
        items: [
          { label: "Painel", href: dashboardHref, icon: "PA", roles: ["administrador", "funcionarios", "professores", "responsaveis"] },
          { label: "Comunicacao", href: inOrganization ? "../comunicacao.html" : "comunicacao.html", icon: "CO", roles: ["administrador", "funcionarios", "professores", "responsaveis"] }
        ]
      },
      {
        section: "Organizacao",
        items: [
          { label: "Turmas", href: `${organizationPrefix}turmas.html`, icon: "TU", roles: ["administrador", "funcionarios"] },
          { label: "Disciplinas", href: `${organizationPrefix}disciplinas.html`, icon: "DI", roles: ["administrador", "funcionarios"] },
          { label: "Equipe", href: `${organizationPrefix}equipe.html`, icon: "EQ", roles: ["administrador", "funcionarios"] },
          { label: "Professores", href: `${organizationPrefix}professores.html`, icon: "PR", roles: ["administrador", "funcionarios"] },
          { label: "Alunos", href: `${organizationPrefix}alunos.html`, icon: "AL", roles: ["administrador", "funcionarios"] },
          { label: "Responsaveis", href: `${organizationPrefix}responsaveis.html`, icon: "RE", roles: ["administrador", "funcionarios"] }
        ]
      }
    ];
  }

  function normalizeHref(href) {
    const link = document.createElement("a");
    link.href = href;
    return link.href;
  }

  function getCollapsedState() {
    return localStorage.getItem(SIDEBAR_STATE_KEY) === "true";
  }

  function saveCollapsedState(isCollapsed) {
    localStorage.setItem(SIDEBAR_STATE_KEY, String(isCollapsed));
  }

  function updateCollapseControls(sidebar, collapseButton, toggleButton) {
    const collapsed = sidebar.classList.contains("collapsed");
    collapseButton.textContent = collapsed ? ">" : "<";
    toggleButton.textContent = collapsed ? ">" : "=";
  }

  async function mountShell() {
    const session = await window.AgendaGamaAuth.protectPage();
    if (!session) return;
    activeShellSession = session;

    document.body.classList.add("app-shell-body");

    const appShell = document.getElementById("app-shell");
    appShell.className = "app-shell";
    const currentPath = window.location.href;
    const collapsed = getCollapsedState();

    const sidebarSections = getNavItems().map((section) => {
      const items = section.items
        .filter((item) => item.roles.includes(session.role))
        .map((item) => {
          const isActive = normalizeHref(item.href) === currentPath;
          return `
            <a class="sidebar-link ${isActive ? "active" : ""}" href="${item.href}" title="${item.label}">
              <span class="sidebar-link-icon">${item.icon}</span>
              <span class="sidebar-link-label">${item.label}</span>
            </a>
          `;
        })
        .join("");

      if (!items) return "";

      return `
        <div>
          <span class="nav-label">${section.section}</span>
          <nav class="sidebar-nav">${items}</nav>
        </div>
      `;
    }).join("");

    appShell.innerHTML = `
      <aside class="sidebar ${collapsed ? "collapsed" : ""}" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <span class="brand-badge brand-badge-logo">
              <img src="${isOrganizationPage() ? "../../assets/images/logo-gama.png" : "../assets/images/logo-gama.png"}" alt="Logo do Colegio Gamaliel">
            </span>
            <div class="sidebar-brand-text">
              <strong>Agenda Gama</strong>
              <span>Gestao escolar</span>
            </div>
          </div>
          <button id="sidebar-collapse" class="btn sidebar-collapse" aria-label="Recolher menu" title="Recolher menu">${collapsed ? ">" : "<"}</button>
        </div>

        <div class="user-card">
          <span class="user-avatar">${getInitials(session.name)}</span>
          <strong>${session.name}</strong>
          <p class="user-role">${session.roleLabel}</p>
        </div>

        <div class="sidebar-sections">
          ${sidebarSections}
        </div>

        <div class="sidebar-footer">
          <button id="logout-button" class="btn" title="Sair e trocar conta">
            <span class="sidebar-link-icon">SA</span>
            <span class="sidebar-footer-text">Sair e trocar conta</span>
          </button>
        </div>
      </aside>

      <div class="app-overlay" id="app-overlay"></div>

      <main class="main-content" id="main-content">
        <div class="main-stack" id="main-stack">
          <div class="topbar">
            <button id="menu-toggle" class="menu-toggle btn" aria-label="Abrir menu">${collapsed ? ">" : "="}</button>
            <div class="action-row topbar-actions" style="margin-top: 0;">
              <div class="notification-center" id="notification-center">
                <button id="notification-toggle" class="btn btn-secondary notification-toggle" aria-label="Abrir notificacoes" aria-expanded="false">
                  <span class="notification-toggle-icon">SI</span>
                  <span id="notification-badge" class="notification-badge" hidden>0</span>
                </button>
                <div id="notification-panel" class="notification-panel" hidden>
                  <div class="notification-panel-head">
                    <div>
                      <strong>Notificacoes</strong>
                      <span>Acompanhe mensagens novas e pendencias.</span>
                    </div>
                    <div class="notification-panel-actions">
                      <button id="notification-mark-all" type="button" class="btn btn-secondary btn-sm">Marcar lidas</button>
                      <button id="notification-close" type="button" class="btn btn-secondary btn-sm notification-close" aria-label="Fechar notificacoes">Fechar</button>
                    </div>
                  </div>
                  <div id="notification-list" class="notification-list"></div>
                  <p id="notification-empty" class="notification-empty">Sem notificacoes no momento.</p>
                </div>
              </div>
              <span class="pill">${session.roleLabel}</span>
              <button id="logout-button-mobile" class="btn btn-secondary">Sair</button>
            </div>
          </div>
        </div>
      </main>
    `;

    const mainContent = document.getElementById("main-content");
    const mainStack = document.getElementById("main-stack");
    const pageTemplate = document.getElementById("page-template");
    if (pageTemplate) {
      const contentTarget = document.createElement("div");
      contentTarget.className = "page-content";
      contentTarget.id = "page-content";
      contentTarget.appendChild(pageTemplate.content.cloneNode(true));
      mainStack?.appendChild(contentTarget);

      function resetAllScroll() {
        contentTarget.scrollTop = 0;
        contentTarget.scrollLeft = 0;
        if (mainContent) {
          mainContent.scrollTop = 0;
          mainContent.scrollLeft = 0;
        }
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
      }

      resetAllScroll();
      requestAnimationFrame(resetAllScroll);
      setTimeout(resetAllScroll, 0);
      setTimeout(resetAllScroll, 120);
    }

    if (!document.getElementById("notification-toast-stack")) {
      const toastStack = document.createElement("div");
      toastStack.id = "notification-toast-stack";
      toastStack.className = "notification-toast-stack";
      mainContent?.appendChild(toastStack);
    }
    activeToastHost = document.getElementById("notification-toast-stack");

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("app-overlay");
    const toggle = document.getElementById("menu-toggle");
    const collapseButton = document.getElementById("sidebar-collapse");
    const notificationToggle = document.getElementById("notification-toggle");
    const notificationPanel = document.getElementById("notification-panel");
    const notificationList = document.getElementById("notification-list");
    const notificationBadge = document.getElementById("notification-badge");
    const notificationEmpty = document.getElementById("notification-empty");
    const notificationMarkAll = document.getElementById("notification-mark-all");
    const notificationClose = document.getElementById("notification-close");

    activeNotificationElements = {
      toggle: notificationToggle,
      panel: notificationPanel,
      list: notificationList,
      badge: notificationBadge,
      empty: notificationEmpty,
      markAll: notificationMarkAll
    };
    renderNotifications();
    refreshShellNotifications();

    async function logout() {
      await window.AgendaGamaAuth.clearSession();
      window.location.href = isOrganizationPage() ? "../../index.html" : "../index.html";
    }

    toggle?.addEventListener("click", function () {
      if (window.innerWidth <= 1100) {
        sidebar.classList.toggle("open");
        overlay.classList.toggle("open");
        return;
      }

      sidebar.classList.toggle("collapsed");
      saveCollapsedState(sidebar.classList.contains("collapsed"));
      updateCollapseControls(sidebar, collapseButton, toggle);
    });

    collapseButton?.addEventListener("click", function () {
      if (window.innerWidth <= 1100) {
        sidebar.classList.remove("open");
        overlay.classList.remove("open");
        return;
      }

      sidebar.classList.toggle("collapsed");
      saveCollapsedState(sidebar.classList.contains("collapsed"));
      updateCollapseControls(sidebar, collapseButton, toggle);
    });

    overlay?.addEventListener("click", function () {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
    });

    notificationToggle?.addEventListener("click", function (event) {
      event.stopPropagation();
      const nextHidden = !notificationPanel.hidden;
      notificationPanel.hidden = nextHidden;
      notificationToggle.setAttribute("aria-expanded", String(!nextHidden));
    });

    notificationList?.addEventListener("click", function (event) {
      const button = event.target.closest("[data-notification-id]");
      if (!button) return;
      const notificationId = button.dataset.notificationId;
      const href = button.dataset.notificationHref;
      markNotificationRead(notificationId);
      closeNotificationPanel();
      if (href) {
        window.location.href = href;
      }
    });

    notificationMarkAll?.addEventListener("click", function () {
      markAllNotificationsRead();
    });

    notificationClose?.addEventListener("click", function (event) {
      event.stopPropagation();
      closeNotificationPanel();
    });

    notificationPanel?.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    document.addEventListener("click", function (event) {
      if (!notificationPanel || notificationPanel.hidden) return;
      if (notificationPanel.contains(event.target) || notificationToggle?.contains(event.target)) return;
      closeNotificationPanel();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeNotificationPanel();
      }
    });

    window.addEventListener("storage", function (event) {
      if (event.key === NOTIFICATIONS_KEY) {
        renderNotifications();
        return;
      }

      if (!event.key || event.key.startsWith("agenda-gama-messages") || event.key === THREAD_VIEW_KEY || event.key === THREAD_STATE_KEY) {
        refreshShellNotifications();
      }
    });
    window.addEventListener("agenda-notifications-updated", renderNotifications);
    window.addEventListener("agenda-message-state-changed", refreshShellNotifications);

    if (activeNotificationTimer) {
      window.clearInterval(activeNotificationTimer);
    }
    activeNotificationTimer = window.setInterval(refreshShellNotifications, NOTIFICATION_REFRESH_MS);

    document.getElementById("logout-button")?.addEventListener("click", logout);
    document.getElementById("logout-button-mobile")?.addEventListener("click", logout);
    window.dispatchEvent(new CustomEvent("agenda-shell-ready", { detail: { session } }));
    return session;
  }

  window.AgendaGamaApp = {
    mountShell,
    syncCommunicationNotifications
  };
})();
