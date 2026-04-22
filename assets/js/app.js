(function () {
  const SIDEBAR_STATE_KEY = "agenda-gama-sidebar-collapsed";
  const NOTIFICATIONS_KEY = "agenda-gama-notifications";
  let activeShellSession = null;
  let activeNotificationElements = null;
  let activeToastHost = null;

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
                    <button id="notification-mark-all" type="button" class="btn btn-secondary btn-sm">Marcar lidas</button>
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

    activeNotificationElements = {
      toggle: notificationToggle,
      panel: notificationPanel,
      list: notificationList,
      badge: notificationBadge,
      empty: notificationEmpty,
      markAll: notificationMarkAll
    };
    renderNotifications();

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

    document.addEventListener("click", function (event) {
      if (!notificationPanel || notificationPanel.hidden) return;
      if (notificationPanel.contains(event.target) || notificationToggle?.contains(event.target)) return;
      closeNotificationPanel();
    });

    window.addEventListener("storage", function (event) {
      if (event.key === NOTIFICATIONS_KEY) {
        renderNotifications();
      }
    });
    window.addEventListener("agenda-notifications-updated", renderNotifications);

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
