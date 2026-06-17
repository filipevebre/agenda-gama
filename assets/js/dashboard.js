(function () {
  function ensureShellContent(callback) {
    if (document.getElementById("dashboard-title")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function applyResponsavelView(session) {
    const pill = document.getElementById("dashboard-pill");
    const title = document.getElementById("dashboard-title");
    const description = document.getElementById("dashboard-description");
    const stats = document.getElementById("dashboard-stats");
    const adminPanels = document.getElementById("dashboard-admin-panels");
    const familyHome = document.getElementById("dashboard-family-home");

    if (!pill || !title || !description || !stats || !adminPanels || !familyHome) {
      return;
    }

    if (session?.role === "responsaveis") {
      pill.textContent = "Painel da familia";
      title.textContent = "Acesso rapido da familia";
      description.textContent = "Entre direto no diario, nos comunicados e na comunicacao para acompanhar a rotina da crianca sem excesso de informacao.";
      stats.hidden = true;
      adminPanels.hidden = true;
      familyHome.hidden = false;
      return;
    }

    pill.textContent = "Painel escolar";
    title.textContent = "Rotina escolar centralizada";
    description.textContent = "Organize os principais cadastros da escola em um so lugar, com visao clara para secretaria, direcao, professores e responsaveis.";
    stats.hidden = false;
    adminPanels.hidden = false;
    familyHome.hidden = true;
  }

  function mountDashboard() {
    ensureShellContent(function () {
      const session = window.AgendaGamaAuth?.getSession?.() || null;
      applyResponsavelView(session);

      window.addEventListener("agenda-shell-ready", function handleSession(event) {
        applyResponsavelView(event.detail?.session || null);
      });
    });
  }

  window.AgendaGamaDashboard = {
    mountDashboard
  };
})();
