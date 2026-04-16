(function () {
  const SIDEBAR_STATE_KEY = "agenda-gama-sidebar-collapsed";

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
            <div class="action-row" style="margin-top: 0;">
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

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("app-overlay");
    const toggle = document.getElementById("menu-toggle");
    const collapseButton = document.getElementById("sidebar-collapse");

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

    document.getElementById("logout-button")?.addEventListener("click", logout);
    document.getElementById("logout-button-mobile")?.addEventListener("click", logout);
    window.dispatchEvent(new CustomEvent("agenda-shell-ready", { detail: { session } }));
    return session;
  }

  window.AgendaGamaApp = { mountShell };
})();
