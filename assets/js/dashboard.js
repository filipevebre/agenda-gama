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
    const adminHome = document.getElementById("dashboard-admin-home");
    const familyHome = document.getElementById("dashboard-family-home");

    if (!pill || !title || !description || !stats || !adminPanels || !adminHome || !familyHome) {
      return;
    }

    if (session?.role === "responsaveis") {
      pill.textContent = "Painel da família";
      title.textContent = "Olá, escolha o que deseja acompanhar";
      description.textContent = "Acesse a rotina da criança, os avisos, formulários e conversas da escola.";
      stats.hidden = true;
      adminPanels.hidden = true;
      adminHome.hidden = true;
      familyHome.hidden = false;
      return;
    }

    pill.textContent = "Painel escolar";
    title.textContent = "O que você precisa fazer agora?";
    description.textContent = "Escolha uma área para acessar as tarefas mais usadas da escola.";
    stats.hidden = false;
    adminPanels.hidden = false;
    adminHome.hidden = false;
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
