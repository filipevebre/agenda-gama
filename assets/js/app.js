(function () {
  const SIDEBAR_STATE_KEY = "agenda-gama-sidebar-collapsed";
  const NOTIFICATIONS_KEY = "agenda-gama-notifications";
  const NOTICE_STORAGE_KEY = "agenda-gama-notices";
  const NOTICE_VIEW_KEY = "agenda-gama-notice-view";
  const DIARY_STORAGE_KEY = "agenda-gama-diario";
  const DIARY_VIEW_KEY = "agenda-gama-diary-view";
  const THREAD_VIEW_KEY = "agenda-gama-message-thread-view";
  const THREAD_STATE_KEY = "agenda-gama-message-thread-state";
  const MESSAGE_PREFIX = "AGAMA_MESSAGE::";
  const NOTIFICATION_REFRESH_MS = 12000;
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
  const VIRTUAL_CHANNELS = [
    { id: "setor-secretaria", nome: "Secretaria", channelType: "secretaria", publico: "Atendimento geral", descricao: "Atendimento administrativo e vida escolar." },
    { id: "setor-coordenacao", nome: "Coordenacao", channelType: "coordenacao", publico: "Pedagogico", descricao: "Orientacao pedagogica e acompanhamento escolar." },
    { id: "setor-financeiro", nome: "Financeiro", channelType: "financeiro", publico: "Atendimento", descricao: "Mensalidades, boletos e combinados financeiros." },
    { id: "setor-professor", nome: "Professor", channelType: "professor", publico: "Sala de aula", descricao: "Contato com professor ou equipe docente." }
  ];
  let activeShellSession = null;
  let activeNotificationElements = null;
  let activeNoticeMarqueeElements = null;
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

  function normalizePersonName(value) {
    return normalizeComparableText(value).replace(/^(prof|profa|professor|professora)\.?\s+/, "");
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeComparableText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function slugify(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeTurmaLabel(value) {
    return normalizeComparableText(value)
      .replace(/\u00aa/g, "a")
      .replace(/\u00ba/g, "o");
  }

  function turmaMatches(left, right) {
    return normalizeTurmaLabel(left) === normalizeTurmaLabel(right);
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

  function isNoticeArchived(notice) {
    const archiveDate = normalizeArchiveDate(notice?.archiveDate);
    if (!archiveDate) return false;
    return archiveDate <= getTodayDateKey();
  }

  function normalizeNoticeRecord(item) {
    return {
      ...item,
      id: item.id || `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    const raw = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (!raw) {
      const seeded = NOTICE_SEED.map(normalizeNoticeRecord);
      localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    try {
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeNoticeRecord) : NOTICE_SEED.map(normalizeNoticeRecord);
      localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      const fallback = NOTICE_SEED.map(normalizeNoticeRecord);
      localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  }

  async function loadNotices() {
    return (await safeList("notices", NOTICE_SEED)).map(normalizeNoticeRecord);
  }

  function getNoticeAudienceLabel(audience) {
    const labels = {
      all: "Toda a escola",
      responsaveis: "Responsaveis",
      professores: "Professores",
      funcionarios: "Equipe interna"
    };

    return labels[audience] || "Toda a escola";
  }

  function buildNoticeTurmaSummary(targetTurmas) {
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

  function getComunicadosHref(noticeId) {
    const baseHref = isOrganizationPage() ? "../comunicados.html" : "comunicados.html";
    if (!noticeId) return baseHref;
    return `${baseHref}?notice=${encodeURIComponent(noticeId)}`;
  }

  function getNoticeSourceStamp(notice) {
    return String(notice?.updatedAt || notice?.createdAt || notice?.id || "");
  }

  function dispatchNoticeViewUpdated() {
    window.dispatchEvent(new CustomEvent("agenda-notice-view-updated"));
  }

  function getNoticeSeenMap(session) {
    if (!session) return {};
    const state = readJson(NOTICE_VIEW_KEY, {});
    return state[getNotificationSessionKey(session)] || {};
  }

  function markNoticesSeen(session, notices) {
    if (!session || !Array.isArray(notices) || !notices.length) return;

    const sessionKey = getNotificationSessionKey(session);
    const state = readJson(NOTICE_VIEW_KEY, {});
    const sessionState = {
      ...(state[sessionKey] || {})
    };
    let changed = false;

    notices.forEach(function (notice) {
      if (!notice?.id) return;
      const sourceStamp = getNoticeSourceStamp(notice);
      if (sessionState[notice.id] === sourceStamp) return;
      sessionState[notice.id] = sourceStamp;
      changed = true;
    });

    if (!changed) return;

    state[sessionKey] = sessionState;
    localStorage.setItem(NOTICE_VIEW_KEY, JSON.stringify(state));
    dispatchNoticeViewUpdated();
  }

  function dispatchDiaryViewUpdated() {
    window.dispatchEvent(new CustomEvent("agenda-diary-view-updated"));
  }

  function getDiarySeenMap(session) {
    if (!session) return {};
    const state = readJson(DIARY_VIEW_KEY, {});
    return state[getNotificationSessionKey(session)] || {};
  }

  function getDiaryEntrySourceStamp(entry) {
    return String(entry?.updatedAt || entry?.createdAt || entry?.id || "");
  }

  function markDiaryEntriesSeen(session, entries) {
    if (!session || !Array.isArray(entries) || !entries.length) return;

    const sessionKey = getNotificationSessionKey(session);
    const state = readJson(DIARY_VIEW_KEY, {});
    const sessionState = {
      ...(state[sessionKey] || {})
    };
    let changed = false;

    entries.forEach(function (entry) {
      if (!entry?.id) return;
      const sourceStamp = getDiaryEntrySourceStamp(entry);
      if (sessionState[entry.id] === sourceStamp) return;
      sessionState[entry.id] = sourceStamp;
      changed = true;
    });

    if (!changed) return;

    state[sessionKey] = sessionState;
    localStorage.setItem(DIARY_VIEW_KEY, JSON.stringify(state));
    dispatchDiaryViewUpdated();
  }

  function markThreadSeen(session, threadKey, timestamp) {
    if (!session || !threadKey) return;

    const sessionKey = getNotificationSessionKey(session);
    const state = readJson(THREAD_VIEW_KEY, {});
    const nextTimestamp = String(timestamp || new Date().toISOString());
    const currentSessionState = {
      ...(state[sessionKey] || {})
    };

    if (currentSessionState[threadKey] === nextTimestamp) return;

    state[sessionKey] = {
      ...currentSessionState,
      [threadKey]: nextTimestamp
    };
    localStorage.setItem(THREAD_VIEW_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("agenda-message-state-changed"));
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

  function getDiaryHref(entryId) {
    const baseHref = isOrganizationPage() ? "../diario.html" : "diario.html";
    if (!entryId) return baseHref;
    return `${baseHref}?entry=${encodeURIComponent(entryId)}`;
  }

  async function safeList(key, seedData) {
    try {
      return await window.AgendaGamaDataStore.list(key, seedData);
    } catch (error) {
      console.warn(`[Agenda Gama] Nao foi possivel carregar ${key} para o shell.`, error);
      return [];
    }
  }

  async function loadNoticeDirectory() {
    if (!window.AgendaGamaDataStore?.list) {
      return {
        turmas: [],
        alunos: [],
        responsaveis: [],
        professores: []
      };
    }

    const [turmas, alunos, responsaveis, professores] = await Promise.all([
      safeList("turmas", []),
      safeList("alunos", []),
      safeList("responsaveis", []),
      safeList("professores", [])
    ]);

    return {
      turmas: turmas || [],
      alunos: alunos || [],
      responsaveis: responsaveis || [],
      professores: professores || []
    };
  }

  function buildNoticeSessionContext(session, directory) {
    const alunos = directory.alunos || [];
    const responsaveis = directory.responsaveis || [];
    const professores = directory.professores || [];

      const professor = professores.find(function (item) {
        return String(item.auth_user_id || "") === String(session?.userId || "")
          || normalizeComparableText(item.email) === normalizeComparableText(session?.email)
          || normalizePersonName(item.nome) === normalizePersonName(session?.name);
      }) || null;

    const responsavelRecords = responsaveis.filter(function (item) {
      return String(item.auth_user_id || "") === String(session?.userId || "")
        || normalizeComparableText(item.email) === normalizeComparableText(session?.email)
        || normalizePersonName(item.nome) === normalizePersonName(session?.name);
    });

    const responsavelTurmas = new Set();
    const linkedStudentIds = new Set();
    responsavelRecords.forEach(function (record) {
      const aluno = record.aluno_id
        ? alunos.find(function (item) { return item.id === record.aluno_id; }) || null
        : alunos.find(function (item) { return normalizeComparableText(item.nome) === normalizeComparableText(record.aluno); }) || null;
      if (aluno?.id) {
        linkedStudentIds.add(aluno.id);
      }
      if (aluno?.turma) {
        responsavelTurmas.add(aluno.turma);
      }
    });

    const professorTurmas = new Set();
    if (professor?.turmas) {
      String(professor.turmas || "")
        .split(",")
        .map(function (item) { return item.split(" - ")[0].trim(); })
        .filter(Boolean)
        .forEach(function (turma) {
          professorTurmas.add(turma);
        });
    }

    return {
      responsavelRecords: responsavelRecords,
      linkedStudentIds: linkedStudentIds,
      responsavelTurmas: responsavelTurmas,
      professorTurmas: professorTurmas
    };
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

  function sortNotices(items) {
    return [...items].sort(function (left, right) {
      if (Boolean(left.urgent) !== Boolean(right.urgent)) {
        return left.urgent ? -1 : 1;
      }

      if (Boolean(left.pinned) !== Boolean(right.pinned)) {
        return left.pinned ? -1 : 1;
      }

      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }

  async function listVisibleNoticesForSession(session) {
    const directory = await loadNoticeDirectory();
    const context = buildNoticeSessionContext(session, directory);
    return sortNotices(await loadNotices()).filter(function (notice) {
      if (isNoticeArchived(notice)) {
        return false;
      }

      return noticeMatchesAudience(notice, session) && noticeMatchesTurmas(notice, session, context);
    });
  }

  async function refreshShellNoticeMarquee() {
    if (!activeShellSession || !activeNoticeMarqueeElements?.root) return;

    try {
      const notices = await listVisibleNoticesForSession(activeShellSession);
      const seenMap = getNoticeSeenMap(activeShellSession);
      const unseenNotices = notices.filter(function (notice) {
        return seenMap[notice.id] !== getNoticeSourceStamp(notice);
      });
      const featuredNotice = unseenNotices[0] || null;

      if (!featuredNotice) {
        activeNoticeMarqueeElements.root.hidden = true;
        activeNoticeMarqueeElements.root.classList.remove("is-urgent");
        activeNoticeMarqueeElements.root.removeAttribute("data-href");
        return;
      }

      activeNoticeMarqueeElements.root.hidden = false;
      activeNoticeMarqueeElements.root.classList.toggle("is-urgent", Boolean(featuredNotice.urgent));
      activeNoticeMarqueeElements.root.dataset.href = getComunicadosHref(featuredNotice.id);
      activeNoticeMarqueeElements.kicker.textContent = featuredNotice.urgent ? "Comunicado urgente novo" : "Comunicado novo";
      activeNoticeMarqueeElements.title.textContent = featuredNotice.title;
      activeNoticeMarqueeElements.meta.textContent = unseenNotices.length > 1
        ? `${unseenNotices.length} comunicados pendentes - ${buildNoticeTurmaSummary(featuredNotice.targetTurmas)}`
        : `${getNoticeAudienceLabel(featuredNotice.audience)} - ${buildNoticeTurmaSummary(featuredNotice.targetTurmas)}`;
    } catch (error) {
      activeNoticeMarqueeElements.root.hidden = true;
      activeNoticeMarqueeElements.root.classList.remove("is-urgent");
      activeNoticeMarqueeElements.root.removeAttribute("data-href");
    }
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
    setNotificationPanelState(false);
  }

  function syncShellOverlayState() {
    const overlay = activeNotificationElements?.overlay;
    const sidebar = activeNotificationElements?.sidebar;
    const notificationPanel = activeNotificationElements?.panel;
    if (!overlay) return;

    const sidebarOpen = Boolean(sidebar?.classList.contains("open"));
    const notificationOpen = Boolean(notificationPanel && !notificationPanel.hidden && window.innerWidth <= 720);

    overlay.classList.toggle("open", sidebarOpen);
    overlay.classList.toggle("notification-active", false);
    document.body.classList.toggle("notification-panel-open", notificationOpen);
  }

  function setNotificationPanelState(isOpen) {
    if (!activeNotificationElements?.panel || !activeNotificationElements?.toggle) return;
    activeNotificationElements.panel.hidden = !isOpen;
    activeNotificationElements.panel.setAttribute("aria-hidden", String(!isOpen));
    activeNotificationElements.toggle.setAttribute("aria-expanded", String(isOpen));
    activeNotificationElements.toggle.classList.toggle("is-active", isOpen);
    activeNotificationElements.center?.classList.toggle("is-open", isOpen);
    syncShellOverlayState();
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
      const icon = item.kind === "communication-approval"
        ? "AP"
        : String(item.kind || "").startsWith("diary-")
          ? "DR"
          : "MS";
      return `
        <button type="button" class="notification-item ${item.readAt ? "" : "is-unread"}" data-notification-id="${item.id}" data-notification-href="${item.href || ""}">
          <span class="notification-item-icon">${icon}</span>
          <span class="notification-item-copy">
            <strong>${item.title}</strong>
            <span>${item.body}</span>
            <small>${formatNotificationTime(item.createdAt)}</small>
          </span>
        </button>
      `;
    }).join("");
  }

  function syncNotificationPermissionButton() {
    const button = activeNotificationElements?.permissionButton;
    if (!button) return;

    const pwa = window.AgendaGamaPWA;
    const permission = pwa?.getNotificationPermission?.() || "unsupported";
    const mustInstallOnIos = Boolean(pwa?.isIosBrowser?.() && !pwa?.isStandalone?.());

    if (permission === "unsupported") {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    button.disabled = permission === "denied";

    if (mustInstallOnIos) {
      button.textContent = "Instale para ativar";
      button.disabled = false;
      button.title = "No iPhone, instale o app na Tela de Inicio para receber notificacoes.";
      return;
    }

    if (permission === "granted") {
      button.textContent = "Alertas ativos";
      button.title = "As notificacoes do celular estao ativas.";
      return;
    }

    if (permission === "denied") {
      button.textContent = "Permissao bloqueada";
      button.title = "Libere as notificacoes nas configuracoes do navegador.";
      return;
    }

    button.textContent = "Ativar no celular";
    button.title = "Permitir notificacoes nativas do celular para mensagens e diario.";
  }

  async function showSystemNotification(notification) {
    const pwa = window.AgendaGamaPWA;
    if (!notification || !pwa?.showNotification) return false;

    return pwa.showNotification({
      id: notification.id,
      kind: notification.kind,
      tag: notification.dedupeKey || notification.id,
      title: notification.title,
      body: notification.body,
      href: notification.href
    });
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

    toast.addEventListener("click", async function () {
      markNotificationRead(notification.id);
      await markNotificationSourceSeen(notification);
      if (notification.href) {
        openNotificationDestination(notification.href);
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
      toastQueue.slice(0, 2).forEach(function (notification) {
        void showSystemNotification(notification);
      });
    }
  }

  function syncDiaryNotifications(session, alerts) {
    if (!session) return;

    const sessionKey = getNotificationSessionKey(session);
    const previousNotifications = readNotifications();
    const currentSessionNotifications = previousNotifications.filter((item) => item.sessionKey === sessionKey);
    const otherNotifications = previousNotifications.filter((item) => item.sessionKey !== sessionKey);
    const activeAlerts = (alerts || []).filter(Boolean);
    const activeKeys = new Set(activeAlerts.map((item) => item.dedupeKey));
    const preservedSessionNotifications = currentSessionNotifications.filter((item) => !String(item.kind || "").startsWith("diary-") || activeKeys.has(item.dedupeKey));
    const toastQueue = [];

    activeAlerts.forEach((alert) => {
      const existing = currentSessionNotifications.find((item) => item.dedupeKey === alert.dedupeKey) || null;
      const href = alert.href || getDiaryHref(alert.entryId);

      if (!existing) {
        const created = {
          id: generateNotificationId(),
          sessionKey: sessionKey,
          dedupeKey: alert.dedupeKey,
          kind: alert.kind || "diary-entry",
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
      toastQueue.slice(0, 2).forEach(function (notification) {
        void showSystemNotification(notification);
      });
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
    const professor = (directory.professores || []).find((item) => String(item.auth_user_id || "") === String(session.userId || "") || normalizeEmail(item.email) === normalizeEmail(session.email) || normalizePersonName(item.nome) === normalizePersonName(session.name)) || null;
    const funcionario = (directory.equipe || []).find((item) => String(item.auth_user_id || "") === String(session.userId || "") || normalizeEmail(item.email) === normalizeEmail(session.email) || normalizePersonName(item.nome) === normalizePersonName(session.name)) || null;
    const responsavelRecords = (directory.responsaveis || []).filter((item) => normalizeEmail(item.email) === normalizeEmail(session.email));
    const responsavelTurmas = new Set();
    const professorTurmas = new Set();

      if (professor?.turmas) {
        String(professor.turmas).split(",").map((item) => item.split(" - ")[0].trim()).filter(Boolean).forEach((item) => professorTurmas.add(item));
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
        return [...actorContext.professorTurmas].some((turma) => turmaMatches(turma, thread.turma))
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
      safeList("turmas", []),
      safeList("alunos", []),
      safeList("responsaveis", []),
      safeList("professores", []),
      safeList("equipe", []),
      safeList("channels", []),
      safeList("messages", [])
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

  async function buildDiaryAlertsForSession(session) {
    if (!window.AgendaGamaDataStore || session?.role !== "responsaveis") return [];

    const [directory, entries] = await Promise.all([
      loadNoticeDirectory(),
      safeList("diario", [])
    ]);

    const context = buildNoticeSessionContext(session, directory);
    const linkedStudentIds = context.linkedStudentIds || new Set();
    const seenMap = getDiarySeenMap(session);
    if (!linkedStudentIds.size) return [];

    return [...(entries || [])]
      .filter(function (entry) {
        return Boolean(entry?.id)
          && linkedStudentIds.has(entry.studentId)
          && seenMap[entry.id] !== getDiaryEntrySourceStamp(entry);
      })
      .sort(function (left, right) {
        return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
      })
      .map(function (entry) {
        return {
          kind: "diary-entry",
          dedupeKey: `diary:${entry.id}`,
          entryId: entry.id,
          href: getDiaryHref(entry.id),
          title: `Novo registro no diario de ${entry.studentName || "seu aluno"}`,
          body: [entry.turma || "", entry.title || entry.category || "Novo registro disponivel"].filter(Boolean).join(" - "),
          createdAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
          sourceStamp: getDiaryEntrySourceStamp(entry)
        };
      });
  }

  async function refreshShellNotifications() {
    if (!activeShellSession) return;
    try {
      const [communicationAlerts, diaryAlerts] = await Promise.all([
        buildCommunicationAlertsForSession(activeShellSession),
        buildDiaryAlertsForSession(activeShellSession)
      ]);
      syncCommunicationNotifications(activeShellSession, communicationAlerts);
      syncDiaryNotifications(activeShellSession, diaryAlerts);
    } catch (error) {
      renderNotifications();
    }
  }

  async function markNotificationSourceSeen(notification) {
    if (!notification || !activeShellSession) return;

    let targetUrl = null;
    try {
      targetUrl = notification.href ? new URL(notification.href, window.location.href) : null;
    } catch (error) {
      targetUrl = null;
    }

    const entryId = targetUrl?.searchParams.get("entry");
    if (entryId) {
      const entries = await safeList("diario", []);
      const matchedEntry = (entries || []).find(function (entry) {
        return String(entry?.id || "") === String(entryId);
      }) || null;
      if (matchedEntry) {
        markDiaryEntriesSeen(activeShellSession, [matchedEntry]);
      }
      return;
    }

    const noticeId = targetUrl?.searchParams.get("notice");
    if (noticeId) {
      const notices = await loadNotices();
      const matchedNotice = notices.find(function (notice) {
        return String(notice?.id || "") === String(noticeId);
      }) || null;
      if (matchedNotice) {
        markNoticesSeen(activeShellSession, [matchedNotice]);
      }
      return;
    }

    const threadKey = targetUrl?.searchParams.get("thread");
    if (threadKey) {
      markThreadSeen(activeShellSession, threadKey, notification.createdAt || notification.sourceStamp || new Date().toISOString());
    }
  }

  async function markNotificationsSourceSeen(notifications) {
    if (!Array.isArray(notifications) || !notifications.length) return;
    await Promise.all(notifications.map(function (notification) {
      return markNotificationSourceSeen(notification);
    }));
  }

  function openNotificationDestination(href) {
    if (!href) return;

    let targetUrl = null;
    try {
      targetUrl = new URL(href, window.location.href);
    } catch (error) {
      window.location.href = href;
      return;
    }

    const currentUrl = new URL(window.location.href);
    const entryId = targetUrl.searchParams.get("entry");
    if (entryId && targetUrl.pathname === currentUrl.pathname && window.AgendaGamaDiario?.openEntryById) {
      window.AgendaGamaDiario.openEntryById(entryId);
      return;
    }

    window.location.href = href;
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
          { label: "Diário", href: inOrganization ? "../diario.html" : "diario.html", icon: "DR", roles: ["administrador", "funcionarios", "professores", "responsaveis"] },
          { label: "Atividades", href: inOrganization ? "../atividades.html" : "atividades.html", icon: "AT", roles: ["administrador", "funcionarios", "professores", "responsaveis"] },
          { label: "Comunicados", href: inOrganization ? "../comunicados.html" : "comunicados.html", icon: "CM", roles: ["administrador", "funcionarios", "professores", "responsaveis"] },
          { label: "Comunicação", href: inOrganization ? "../comunicacao.html" : "comunicacao.html", icon: "CO", roles: ["administrador", "funcionarios", "professores", "responsaveis"] },
          { label: "Formulários", href: inOrganization ? "../formularios.html" : "formularios.html", icon: "FO", roles: ["administrador", "funcionarios", "professores", "responsaveis"] }
        ]
      },
      {
        section: "Organização",
        items: [
          { label: "Turmas", href: `${organizationPrefix}turmas.html`, icon: "TU", roles: ["administrador", "funcionarios"] },
          { label: "Disciplinas", href: `${organizationPrefix}disciplinas.html`, icon: "DI", roles: ["administrador", "funcionarios"] },
          { label: "Equipe", href: `${organizationPrefix}equipe.html`, icon: "EQ", roles: ["administrador", "funcionarios"] },
          { label: "Professores", href: `${organizationPrefix}professores.html`, icon: "PR", roles: ["administrador", "funcionarios"] },
          { label: "Alunos", href: `${organizationPrefix}alunos.html`, icon: "AL", roles: ["administrador", "funcionarios"] },
          { label: "Responsáveis", href: `${organizationPrefix}responsaveis.html`, icon: "RE", roles: ["administrador", "funcionarios"] }
        ]
      }
    ];
  }

  function getNavIcon(icon) {
    const paths = {
      PA: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
      DR: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22.5z"/><path d="M4 5.5v17"/><path d="M8 7h8M8 11h7"/>',
      AT: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5"/><path d="m13 16 2 2 4-5"/>',
      CM: '<path d="M4 13h3l10 4V5L7 9H4z"/><path d="m7 13 2 6h3l-2-5"/><path d="M20 9v4"/>',
      CO: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
      FO: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/><path d="m8.5 7 .7.7 1.3-1.5"/>',
      TU: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3.2 0 5 1.7 5 5"/>',
      DI: '<path d="M5 3h14v18H5z"/><path d="M9 3v18M12 8h4M12 12h4"/>',
      EQ: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/>',
      PR: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-4 2.5-7 6-7 2 0 3.7 1 4.8 2.5"/><path d="m15 18 2 2 4-5"/>',
      AL: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11.5V17c3.5 2.6 8.5 2.6 12 0v-5.5M22 9v7"/>',
      RE: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-4 2.5-7 6-7 2.2 0 4 1.1 5 2.8"/><path d="M18 14.5c-2.5-2.5-6 1-3.5 3.5L18 21l3.5-3c2.5-2.5-1-6-3.5-3.5z"/>',
      AP: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/>',
      SA: '<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/>',
      NO: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      FI: '<path d="M4 6h16M7 12h10M10 18h4"/>'
    };
    const path = paths[icon] || paths.PA;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  function setupMobileFilterDisclosure(contentTarget) {
    const toolbars = contentTarget.querySelectorAll(".diary-filter-toolbar, .notice-toolbar, .message-filter-grid, .school-form-toolbar, .activity-toolbar");
    toolbars.forEach(function (toolbar) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mobile-filter-toggle";
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = `<span>${getNavIcon("FI")}</span><strong>Filtros</strong><small>Mostrar opções</small>`;
      toolbar.before(button);
      button.addEventListener("click", function () {
        const isOpen = toolbar.classList.toggle("is-mobile-open");
        button.classList.toggle("is-open", isOpen);
        button.setAttribute("aria-expanded", String(isOpen));
        button.querySelector("small").textContent = isOpen ? "Ocultar opções" : "Mostrar opções";
      });
    });
  }

  function normalizeHref(href) {
    const link = document.createElement("a");
    link.href = href;
    return link.href;
  }

  function isCurrentHref(href) {
    try {
      return new URL(normalizeHref(href)).pathname === window.location.pathname;
    } catch (error) {
      return normalizeHref(href) === window.location.href;
    }
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

  function getPageContext() {
    const navSections = getNavItems();

    for (const section of navSections) {
      const matchedItem = section.items.find(function (item) {
        return isCurrentHref(item.href);
      });

      if (matchedItem) {
        return {
          section: section.section,
          label: matchedItem.label
        };
      }
    }

    const rawTitle = String(document.title || "Agenda Gama").split("|").pop() || "Agenda Gama";
    return {
      section: isOrganizationPage() ? "Organização" : "Área atual",
      label: rawTitle.trim()
    };
  }

  async function mountShell() {
    const session = await window.AgendaGamaAuth.protectPage();
    if (!session) return;
    activeShellSession = session;

    document.body.classList.add("app-shell-body");

    const appShell = document.getElementById("app-shell");
    appShell.className = "app-shell";
    const collapsed = getCollapsedState();
    const pageContext = getPageContext();

    const sidebarSections = getNavItems().map((section) => {
      const items = section.items
        .filter((item) => item.roles.includes(session.role))
        .map((item) => {
          const isActive = isCurrentHref(item.href);
          return `
            <a class="sidebar-link ${isActive ? "active" : ""}" href="${item.href}" title="${item.label}">
              <span class="sidebar-link-icon">${getNavIcon(item.icon)}</span>
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

    const mobilePrimaryIcons = new Set(["PA", "DR", "AT", "CM", "CO"]);
    const mobileNavigation = getNavItems()[0].items
      .filter((item) => item.roles.includes(session.role))
      .filter((item) => mobilePrimaryIcons.has(item.icon))
      .map((item) => {
        const isActive = isCurrentHref(item.href);
        return `
          <a class="mobile-tabbar-link ${isActive ? "active" : ""}" href="${item.href}">
            <span>${getNavIcon(item.icon)}</span>
            <small>${item.label}</small>
          </a>
        `;
      })
      .join("");

    appShell.innerHTML = `
      <aside class="sidebar ${collapsed ? "collapsed" : ""}" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <span class="brand-badge brand-badge-logo">
              <img src="${isOrganizationPage() ? "../../assets/images/logo-gama.png" : "../assets/images/logo-gama.png"}" alt="Logo do Colegio Gamaliel">
            </span>
            <div class="sidebar-brand-text">
              <strong>Agenda Gama</strong>
              <span>Gestão escolar</span>
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
          <button id="install-app-button" type="button" class="btn install-app-button" title="Instalar app" hidden>
            <span class="sidebar-link-icon">${getNavIcon("AP")}</span>
            <span class="sidebar-footer-text">Instalar app</span>
          </button>
          <button id="logout-button" class="btn" title="Sair e trocar conta">
            <span class="sidebar-link-icon">${getNavIcon("SA")}</span>
            <span class="sidebar-footer-text">Sair e trocar conta</span>
          </button>
        </div>
      </aside>

      <div class="app-overlay" id="app-overlay"></div>

      <main class="main-content" id="main-content">
        <div class="main-stack" id="main-stack">
          <div class="topbar">
            <button id="menu-toggle" class="menu-toggle btn" aria-label="Abrir menu">${collapsed ? ">" : "="}</button>
            <div class="topbar-context" aria-label="Página atual">
              <small>${pageContext.section}</small>
              <strong>${pageContext.label}</strong>
            </div>
            <div class="action-row topbar-actions" style="margin-top: 0;">
              <div class="notification-center" id="notification-center">
                <button id="notification-toggle" class="btn btn-secondary notification-toggle" aria-label="Abrir notificações" aria-expanded="false">
                  <span class="notification-toggle-icon" aria-hidden="true">${getNavIcon("NO")}</span>
                  <span id="notification-badge" class="notification-badge" hidden>0</span>
                </button>
                <div id="notification-panel" class="notification-panel" hidden>
                  <div class="notification-panel-head">
                    <div>
                      <strong>Notificações</strong>
                      <span>Acompanhe mensagens novas e pendências.</span>
                    </div>
                    <div class="notification-panel-actions">
                      <button id="notification-enable-device" type="button" class="btn btn-secondary btn-sm" hidden>Ativar no celular</button>
                      <button id="notification-mark-all" type="button" class="btn btn-secondary btn-sm">Marcar lidas</button>
                      <button id="notification-close" type="button" class="btn btn-secondary btn-sm notification-close" data-notification-close="true" aria-label="Fechar notificações">x</button>
                    </div>
                  </div>
                  <div id="notification-list" class="notification-list"></div>
                  <p id="notification-empty" class="notification-empty">Sem notificações no momento.</p>
                </div>
              </div>
              <div class="topbar-user" title="${session.name} - ${session.roleLabel}">
                <span class="topbar-user-avatar">${getInitials(session.name)}</span>
                <span class="topbar-user-copy"><strong>${session.name}</strong><small>${session.roleLabel}</small></span>
              </div>
              <button id="logout-button-mobile" class="btn btn-secondary">Sair</button>
            </div>
          </div>
          <button id="notice-marquee" class="notice-marquee" type="button" hidden>
            <span class="notice-marquee-badge">CM</span>
            <span class="notice-marquee-copy">
              <small id="notice-marquee-kicker">Comunicado novo</small>
              <strong id="notice-marquee-title">Abra o mural para ver o comunicado mais recente.</strong>
              <span id="notice-marquee-meta">Clique para abrir o comunicado.</span>
            </span>
            <span class="notice-marquee-cta">Abrir</span>
          </button>
        </div>
      </main>
      <nav class="mobile-tabbar" aria-label="Navegação principal">
        ${mobileNavigation}
      </nav>
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
      setupMobileFilterDisclosure(contentTarget);

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
    const notificationCenter = document.getElementById("notification-center");
    const notificationToggle = document.getElementById("notification-toggle");
    const notificationPanel = document.getElementById("notification-panel");
    const notificationList = document.getElementById("notification-list");
    const notificationBadge = document.getElementById("notification-badge");
    const notificationEmpty = document.getElementById("notification-empty");
    const notificationMarkAll = document.getElementById("notification-mark-all");
    const notificationEnableDevice = document.getElementById("notification-enable-device");
    const notificationClose = document.getElementById("notification-close");
    const noticeMarquee = document.getElementById("notice-marquee");
    const noticeMarqueeKicker = document.getElementById("notice-marquee-kicker");
    const noticeMarqueeTitle = document.getElementById("notice-marquee-title");
    const noticeMarqueeMeta = document.getElementById("notice-marquee-meta");
    const installAppButton = document.getElementById("install-app-button");
    activeNotificationElements = {
      center: notificationCenter,
      toggle: notificationToggle,
      panel: notificationPanel,
      list: notificationList,
      badge: notificationBadge,
      empty: notificationEmpty,
      markAll: notificationMarkAll,
      permissionButton: notificationEnableDevice,
      overlay: overlay,
      sidebar: sidebar
    };
    activeNoticeMarqueeElements = {
      root: noticeMarquee,
      kicker: noticeMarqueeKicker,
      title: noticeMarqueeTitle,
      meta: noticeMarqueeMeta
    };
    renderNotifications();
    refreshShellNotifications();
    refreshShellNoticeMarquee();
    syncNotificationPermissionButton();
    void syncDevicePushSubscription();

    async function logout() {
      await window.AgendaGamaPWA?.removePushSubscription?.({ unsubscribe: false });
      await window.AgendaGamaAuth.clearSession();
      window.location.href = isOrganizationPage() ? "../../index.html" : "../index.html";
    }

    async function syncDevicePushSubscription() {
      const pwa = window.AgendaGamaPWA;
      if (!activeShellSession || !pwa?.syncPushSubscription) return false;
      if (pwa.getNotificationPermission?.() !== "granted") return false;

      try {
        return Boolean(await pwa.syncPushSubscription());
      } catch (error) {
        console.warn("[Agenda Gama] Nao foi possivel sincronizar o dispositivo para push.", error);
        return false;
      }
    }

    async function handleEnableDeviceNotifications() {
      const pwa = window.AgendaGamaPWA;
      const triggerButton = activeNotificationElements?.permissionButton || null;
      const originalLabel = triggerButton?.textContent || "Ativar no celular";

      if (!pwa?.requestNotificationPermission) {
        window.alert("Este navegador nao oferece suporte a notificacoes push neste momento.");
        return;
      }

      if (pwa.isIosBrowser?.() && !pwa.isStandalone?.()) {
        window.alert("No iPhone, instale o Agenda Gama na Tela de Inicio primeiro. Depois abra o app instalado e ative as notificacoes.");
        return;
      }

      if (triggerButton) {
        triggerButton.disabled = true;
        triggerButton.textContent = "Ativando...";
      }

      const permission = await pwa.requestNotificationPermission().catch(function () {
        return "default";
      });
      syncNotificationPermissionButton();

      if (permission === "granted") {
        const synced = await syncDevicePushSubscription();
        if (!synced) {
          window.alert("A permissao foi liberada, mas o dispositivo ainda nao conseguiu se registrar para push. Verifique as configuracoes do Supabase e tente novamente.");
          return;
        }
        await pwa.showNotification({
          id: "agenda-gama-notification-enabled",
          tag: "agenda-gama-notification-enabled",
          title: "Notificacoes ativadas",
          body: "Agora o Agenda Gama pode avisar sobre mensagens novas e registros do diario.",
          href: window.location.href
        });
        return;
      }

      if (permission === "denied") {
        window.alert("As notificacoes ficaram bloqueadas. Se quiser ativar depois, libere nas configuracoes do navegador ou do app instalado.");
        return;
      }

      if (permission === "default") {
        if (triggerButton) {
          triggerButton.disabled = false;
          triggerButton.textContent = originalLabel;
        }
        window.alert("O navegador nao abriu a permissao de notificacoes. Tente novamente e, se estiver no celular, use o app instalado ou confira se o site nao esta bloqueado nas configuracoes do navegador.");
      }
    }

    function bindTapButton(button, handler) {
      if (!button) return;

      let lastHandledAt = 0;

      function runHandler(event) {
        if (button.disabled) return;
        const now = Date.now();
        if (now - lastHandledAt < 500) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        lastHandledAt = now;
        event.preventDefault();
        event.stopPropagation();
        handler(event);
      }

      button.addEventListener("touchend", function (event) {
        runHandler(event);
      }, { passive: false });

      button.addEventListener("pointerup", function (event) {
        if (event.pointerType && event.pointerType !== "touch") return;
        runHandler(event);
      });

      button.addEventListener("click", function (event) {
        runHandler(event);
      });
    }

    function syncInstallAppButton() {
      if (!installAppButton) return;

      const pwa = window.AgendaGamaPWA;
      const isStandalone = Boolean(pwa?.isStandalone?.());
      const isIosBrowser = Boolean(pwa?.isIosBrowser?.());
      const canInstall = Boolean(pwa?.canInstall?.());
      const shouldShow = !isStandalone && (canInstall || isIosBrowser);

      installAppButton.hidden = !shouldShow;
      installAppButton.title = canInstall ? "Instalar app" : "Como instalar no celular";
      installAppButton.querySelector(".sidebar-footer-text").textContent = canInstall ? "Instalar app" : "Como instalar";
    }

    async function handleInstallApp() {
      const pwa = window.AgendaGamaPWA;
      if (!pwa || pwa.isStandalone?.()) return;

      if (pwa.canInstall?.()) {
        await pwa.promptInstall();
        syncInstallAppButton();
        return;
      }

      if (pwa.isIosBrowser?.()) {
        window.alert("No iPhone, toque em Compartilhar e depois em 'Adicionar à Tela de Início'.");
        return;
      }

      window.alert("Use o menu do navegador e escolha a opção de instalar este app.");
    }

    toggle?.addEventListener("click", function () {
      if (window.innerWidth <= 1100) {
        sidebar.classList.toggle("open");
        syncShellOverlayState();
        return;
      }

      sidebar.classList.toggle("collapsed");
      saveCollapsedState(sidebar.classList.contains("collapsed"));
      updateCollapseControls(sidebar, collapseButton, toggle);
    });

    collapseButton?.addEventListener("click", function () {
      if (window.innerWidth <= 1100) {
        sidebar.classList.remove("open");
        syncShellOverlayState();
        return;
      }

      sidebar.classList.toggle("collapsed");
      saveCollapsedState(sidebar.classList.contains("collapsed"));
      updateCollapseControls(sidebar, collapseButton, toggle);
    });

    overlay?.addEventListener("click", function () {
      closeNotificationPanel();
      sidebar.classList.remove("open");
      syncShellOverlayState();
    });

    notificationToggle?.addEventListener("click", function (event) {
      event.stopPropagation();
      setNotificationPanelState(notificationPanel.hidden);
    });

    notificationList?.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-notification-id]");
      if (!button) return;
      const notificationId = button.dataset.notificationId;
      const href = button.dataset.notificationHref;
      const notification = listSessionNotifications(activeShellSession).find(function (item) {
        return item.id === notificationId;
      }) || null;
      markNotificationRead(notificationId);
      await markNotificationSourceSeen(notification);
      closeNotificationPanel();
      if (href) {
        openNotificationDestination(href);
      }
    });

    bindTapButton(notificationMarkAll, function () {
      void (async function () {
        const unreadNotifications = listSessionNotifications(activeShellSession).filter(function (item) {
          return !item.readAt;
        });
        markAllNotificationsRead();
        await markNotificationsSourceSeen(unreadNotifications);
      })();
    });

    bindTapButton(notificationEnableDevice, function () {
      void handleEnableDeviceNotifications();
    });

    bindTapButton(notificationClose, function () {
      closeNotificationPanel();
    });

    noticeMarquee?.addEventListener("click", async function () {
      const href = noticeMarquee.dataset.href;
      if (!href) return;
      const notices = await loadNotices();
      const noticeId = new URL(href, window.location.href).searchParams.get("notice");
      const matchedNotice = notices.find(function (item) { return item.id === noticeId; }) || null;
      if (matchedNotice) {
        markNoticesSeen(activeShellSession, [matchedNotice]);
      }
      window.location.href = href;
    });

    notificationPanel?.addEventListener("click", function (event) {
      const closeButton = event.target.closest("[data-notification-close]");
      if (closeButton) {
        event.preventDefault();
        closeNotificationPanel();
        return;
      }
      event.stopPropagation();
    });

    function handleNotificationOutsideInteraction(event) {
      if (!notificationPanel || notificationPanel.hidden) return;
      if (notificationPanel.contains(event.target) || notificationToggle?.contains(event.target)) return;
      closeNotificationPanel();
    }

    document.addEventListener("click", handleNotificationOutsideInteraction);
    document.addEventListener("touchstart", handleNotificationOutsideInteraction, { passive: true });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeNotificationPanel();
      }
    });

    window.addEventListener("resize", function () {
      syncShellOverlayState();
    });

    window.addEventListener("storage", function (event) {
      if (event.key === NOTIFICATIONS_KEY) {
        renderNotifications();
        return;
      }

      if (event.key === NOTICE_STORAGE_KEY) {
        refreshShellNoticeMarquee();
        return;
      }

      if (event.key === NOTICE_VIEW_KEY) {
        refreshShellNoticeMarquee();
        return;
      }

      if (event.key === DIARY_VIEW_KEY) {
        refreshShellNotifications();
        return;
      }

      if (event.key === DIARY_STORAGE_KEY) {
        refreshShellNotifications();
        return;
      }

      if (!event.key || event.key.startsWith("agenda-gama-messages") || event.key === THREAD_VIEW_KEY || event.key === THREAD_STATE_KEY) {
        refreshShellNotifications();
      }
    });
    window.addEventListener("agenda-notifications-updated", renderNotifications);
    window.addEventListener("agenda-notices-updated", refreshShellNoticeMarquee);
    window.addEventListener("agenda-notice-view-updated", refreshShellNoticeMarquee);
    window.addEventListener("agenda-diary-view-updated", refreshShellNotifications);
    window.addEventListener("agenda-message-state-changed", refreshShellNotifications);
    window.addEventListener("agenda-pwa-ready", syncInstallAppButton);
    window.addEventListener("agenda-pwa-installable", syncInstallAppButton);
    window.addEventListener("agenda-pwa-installed", syncInstallAppButton);
    window.addEventListener("agenda-pwa-ready", syncNotificationPermissionButton);
    window.addEventListener("agenda-pwa-installed", syncNotificationPermissionButton);
    window.addEventListener("agenda-pwa-notification-permission-changed", function () {
      syncNotificationPermissionButton();
      if (window.AgendaGamaPWA?.getNotificationPermission?.() === "granted") {
        void syncDevicePushSubscription();
        return;
      }
      if (window.AgendaGamaPWA?.getNotificationPermission?.() === "denied") {
        void window.AgendaGamaPWA?.removePushSubscription?.({ unsubscribe: false });
      }
    });
    window.addEventListener("focus", syncInstallAppButton);
    window.addEventListener("focus", function () {
      syncNotificationPermissionButton();
      void syncDevicePushSubscription();
      refreshShellNotifications();
      refreshShellNoticeMarquee();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      syncInstallAppButton();
      syncNotificationPermissionButton();
      void syncDevicePushSubscription();
      refreshShellNotifications();
      refreshShellNoticeMarquee();
    });
    window.addEventListener("load", syncInstallAppButton, { once: true });
    navigator.serviceWorker?.addEventListener?.("message", function (event) {
      if (event.data?.type !== "agenda-push-received") return;
      refreshShellNotifications();
      refreshShellNoticeMarquee();
    });

    if (activeNotificationTimer) {
      window.clearInterval(activeNotificationTimer);
    }
    activeNotificationTimer = window.setInterval(function () {
      refreshShellNotifications();
      refreshShellNoticeMarquee();
    }, NOTIFICATION_REFRESH_MS);

    document.getElementById("logout-button")?.addEventListener("click", logout);
    document.getElementById("logout-button-mobile")?.addEventListener("click", logout);
    installAppButton?.addEventListener("click", handleInstallApp);
    syncInstallAppButton();
    window.dispatchEvent(new CustomEvent("agenda-shell-ready", { detail: { session } }));
    return session;
  }

  window.AgendaGamaApp = {
    mountShell,
    syncCommunicationNotifications,
    markNoticesSeen,
    markDiaryEntriesSeen
  };
})();
