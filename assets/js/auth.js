(function () {
  const LOCAL_SYSTEM_USERS = [
    { name: "Amanda Gama", email: "admin@gama.edu.br", password: "123456", role: "administrador", roleLabel: "Administrador", canApprove: true, firstAccessPending: false },
    { name: "Carlos Secretaria", email: "funcionario@gama.edu.br", password: "123456", role: "funcionarios", roleLabel: "Funcionario", canApprove: false, firstAccessPending: false },
    { name: "Prof. Helena Souza", email: "professor@gama.edu.br", password: "123456", role: "professores", roleLabel: "Professor", canApprove: false, firstAccessPending: false },
    { name: "Mariana Alves", email: "responsavel@gama.edu.br", password: "123456", role: "responsaveis", roleLabel: "Responsavel", canApprove: false, firstAccessPending: false }
  ];

  const LOCAL_USERS_KEY = "agenda-gama-users";
  const LOCAL_SESSION_KEY = "agenda-gama-session";
  const RESPONSAVEIS_KEY = "agenda-gama-responsaveis";

  let cachedSession = null;
  let cachedUsers = [];

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function readJson(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function isOrganizationPage() {
    return window.location.href.includes("/app/organizacao/");
  }

  function isFirstAccessPage() {
    return window.location.href.includes("/app/criar-senha.html");
  }

  function loginPath() {
    return isOrganizationPage() ? "../../index.html" : "../index.html";
  }

  function dashboardPath() {
    return isOrganizationPage() ? "../dashboard.html" : "dashboard.html";
  }

  function firstAccessPath() {
    return isOrganizationPage() ? "../criar-senha.html" : "criar-senha.html";
  }

  function roleCanAccessPage(role, pageRoles) {
    if (!pageRoles || pageRoles === "all") return true;
    return pageRoles.split(",").map((item) => item.trim()).includes(role);
  }

  function localSeedUsers() {
    const savedUsers = readJson(LOCAL_USERS_KEY, null);
    if (Array.isArray(savedUsers) && savedUsers.length) {
      return savedUsers;
    }

    writeJson(LOCAL_USERS_KEY, LOCAL_SYSTEM_USERS);
    return LOCAL_SYSTEM_USERS;
  }

  function getLocalUsers() {
    return localSeedUsers();
  }

  function getLocalSession() {
    return readJson(LOCAL_SESSION_KEY, null);
  }

  function saveLocalSession(user) {
    writeJson(LOCAL_SESSION_KEY, user);
    cachedSession = user;
  }

  function clearLocalSession() {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    cachedSession = null;
  }

  function mapProfileToSession(user, profile) {
    return {
      userId: user.id,
      name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      email: normalizeEmail(profile?.email || user.email),
      role: profile?.role || user.user_metadata?.role || "responsaveis",
      roleLabel: profile?.role_label || user.user_metadata?.role_label || "Responsavel",
      canApprove: Boolean(profile?.can_approve || user.user_metadata?.can_approve),
      firstAccessPending: Boolean(profile?.first_access_pending || user.user_metadata?.first_access_pending)
    };
  }

  function mapProfileToUser(profile) {
    return {
      userId: profile.id,
      name: profile.full_name,
      email: normalizeEmail(profile.email),
      role: profile.role,
      roleLabel: profile.role_label,
      canApprove: Boolean(profile.can_approve),
      firstAccessPending: Boolean(profile.first_access_pending)
    };
  }

  async function isSupabaseEnabled() {
    return Boolean(window.AgendaGamaSupabase) && await window.AgendaGamaSupabase.isConfigured();
  }

  async function refreshSupabaseUsers() {
    if (!(await isSupabaseEnabled())) {
      cachedUsers = getLocalUsers();
      return cachedUsers;
    }

    try {
      const profiles = await window.AgendaGamaSupabase.listProfiles();
      cachedUsers = profiles.map(mapProfileToUser);
    } catch (error) {
      cachedUsers = [];
    }

    return cachedUsers;
  }

  async function loadSupabaseSession() {
    if (!(await isSupabaseEnabled())) {
      cachedSession = getLocalSession();
      cachedUsers = getLocalUsers();
      return cachedSession;
    }

    const session = await window.AgendaGamaSupabase.waitForSession(2000);
    if (!session?.user) {
      cachedSession = null;
      return null;
    }

    const profile = await window.AgendaGamaSupabase.getProfile(session.user.id);
    cachedSession = mapProfileToSession(session.user, profile);
    await refreshSupabaseUsers();
    return cachedSession;
  }

  async function clearSession() {
    if (await isSupabaseEnabled()) {
      await window.AgendaGamaSupabase.signOut();
      cachedSession = null;
      cachedUsers = [];
      return;
    }

    clearLocalSession();
  }

  function getSession() {
    return cachedSession || getLocalSession();
  }

  function getUsers() {
    return cachedUsers.length ? cachedUsers : getLocalUsers();
  }

  async function redirectAfterLogin(session) {
    window.location.href = session.firstAccessPending ? "app/criar-senha.html" : "app/dashboard.html";
  }

  function renderActiveSession(container, session) {
    container.hidden = false;
    container.innerHTML = `
      <p>Voce esta conectado como <strong>${session.name}</strong> (${session.roleLabel}).</p>
      <div class="action-row">
        <button type="button" id="go-dashboard" class="btn btn-primary">${session.firstAccessPending ? "Criar senha agora" : "Continuar nessa conta"}</button>
        <button type="button" id="switch-account" class="btn btn-secondary">Deslogar e entrar em outra</button>
      </div>
    `;
  }

  function syncLoginModeUi(useSupabase) {
    const helperText = document.getElementById("login-helper-text");
    const demoUsers = document.getElementById("demo-users");

    if (helperText) {
      helperText.textContent = useSupabase
        ? "Entre com a conta criada no Supabase. Responsaveis cadastrados recebem convite por e-mail e definem a senha no primeiro acesso."
        : "Use um dos perfis demonstrativos ou entre com o e-mail do responsavel cadastrado pela secretaria.";
    }

    if (demoUsers) {
      demoUsers.hidden = useSupabase;
    }
  }

  function mountLocalLogin(form, feedback) {
    localSeedUsers();

    form?.addEventListener("submit", function (event) {
      event.preventDefault();

      const formData = new FormData(form);
      const email = normalizeEmail(formData.get("email"));
      const password = String(formData.get("password") || "").trim();
      const user = getLocalUsers().find((item) => normalizeEmail(item.email) === email && item.password === password);

      if (!user) {
        feedback.textContent = "Credenciais invalidas. Verifique o e-mail e a senha.";
        feedback.className = "feedback error";
        return;
      }

      saveLocalSession(user);
      feedback.textContent = "Acesso liberado. Redirecionando...";
      feedback.className = "feedback success";

      setTimeout(function () {
        redirectAfterLogin(user);
      }, 400);
    });
  }

  async function mountSupabaseLogin(form, feedback, activeSession) {
    const session = await loadSupabaseSession();
    if (session) {
      form.hidden = true;
      renderActiveSession(activeSession, session);

      document.getElementById("go-dashboard")?.addEventListener("click", function () {
        redirectAfterLogin(session);
      });

      document.getElementById("switch-account")?.addEventListener("click", async function () {
        await clearSession();
        activeSession.hidden = true;
        form.hidden = false;
        feedback.textContent = "Sessao encerrada. Agora voce pode entrar com outra conta.";
        feedback.className = "feedback success";
      });

      return;
    }

    form?.addEventListener("submit", async function (event) {
      event.preventDefault();

      const formData = new FormData(form);
      const email = normalizeEmail(formData.get("email"));
      const password = String(formData.get("password") || "").trim();
      const response = await window.AgendaGamaSupabase.signInWithPassword(email, password);

      if (response.error) {
        feedback.textContent = response.error.message || "Nao foi possivel autenticar no Supabase.";
        feedback.className = "feedback error";
        return;
      }

      const nextSession = await loadSupabaseSession();
      if (!nextSession) {
        feedback.textContent = "Autenticacao realizada, mas nao foi possivel carregar o perfil do usuario.";
        feedback.className = "feedback error";
        return;
      }

      feedback.textContent = nextSession.firstAccessPending
        ? "Convite aceito. Redirecionando para criar sua senha..."
        : "Acesso liberado. Redirecionando...";
      feedback.className = "feedback success";

      setTimeout(function () {
        redirectAfterLogin(nextSession);
      }, 400);
    });
  }

  async function mountLogin() {
    const form = document.getElementById("login-form");
    const feedback = document.getElementById("login-feedback");
    const activeSession = document.getElementById("active-session");

    if (!form || !feedback || !activeSession) {
      return;
    }

    const supabaseEnabled = await isSupabaseEnabled();
    syncLoginModeUi(supabaseEnabled);

    if (supabaseEnabled) {
      await mountSupabaseLogin(form, feedback, activeSession);
      return;
    }

    const session = getLocalSession();
    if (session) {
      form.hidden = true;
      renderActiveSession(activeSession, session);

      document.getElementById("go-dashboard")?.addEventListener("click", function () {
        redirectAfterLogin(session);
      });

      document.getElementById("switch-account")?.addEventListener("click", function () {
        clearLocalSession();
        activeSession.hidden = true;
        form.hidden = false;
        feedback.textContent = "Sessao encerrada. Agora voce pode entrar com outra conta.";
        feedback.className = "feedback success";
      });

      return;
    }

    mountLocalLogin(form, feedback);
  }

  async function mountFirstAccess() {
    const summary = document.getElementById("first-access-user");
    const form = document.getElementById("first-access-form");
    const feedback = document.getElementById("first-access-feedback");
    const logoutButton = document.getElementById("first-access-logout");

    if (!summary || !form || !feedback) {
      return;
    }

    let session = null;

    if (await isSupabaseEnabled()) {
      session = await window.AgendaGamaSupabase.waitForSession(4000);
      if (!session?.user) {
        window.location.href = "../index.html";
        return;
      }

      const profile = await window.AgendaGamaSupabase.getProfile(session.user.id);
      cachedSession = mapProfileToSession(session.user, profile);
      await refreshSupabaseUsers();

      if (!cachedSession.firstAccessPending) {
        window.location.href = "dashboard.html";
        return;
      }
    } else {
      session = getLocalSession();
      if (!session) {
        window.location.href = "../index.html";
        return;
      }

      cachedSession = session;
      if (!session.firstAccessPending) {
        window.location.href = "dashboard.html";
        return;
      }
    }

    summary.innerHTML = `
      <p><strong>Conta:</strong> ${cachedSession.name}</p>
      <p><strong>E-mail:</strong> ${cachedSession.email}</p>
    `;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const formData = new FormData(form);
      const password = String(formData.get("password") || "").trim();
      const confirmPassword = String(formData.get("confirmPassword") || "").trim();

      if (password.length < 6) {
        feedback.textContent = "A nova senha precisa ter pelo menos 6 caracteres.";
        feedback.className = "feedback error";
        return;
      }

      if (password !== confirmPassword) {
        feedback.textContent = "As senhas informadas nao coincidem.";
        feedback.className = "feedback error";
        return;
      }

      if (await isSupabaseEnabled()) {
        const passwordResult = await window.AgendaGamaSupabase.updatePassword(password);
        if (passwordResult.error) {
          feedback.textContent = passwordResult.error.message || "Nao foi possivel salvar a nova senha.";
          feedback.className = "feedback error";
          return;
        }

        await window.AgendaGamaSupabase.updateProfile(cachedSession.userId, { first_access_pending: false });

        try {
          const responsaveis = await window.AgendaGamaSupabase.fetchTable("responsaveis");
          const currentRows = responsaveis.filter((item) => item.auth_user_id === cachedSession.userId);
          await Promise.all(currentRows.map((item) => window.AgendaGamaSupabase.saveRow("responsaveis", {
            ...item,
            access_status: "Acesso ativo"
          })));
        } catch (error) {
          // Silencioso para nao bloquear a troca de senha caso a tabela ainda nao esteja populada.
        }

        cachedSession.firstAccessPending = false;
      } else {
        const users = getLocalUsers();
        const userIndex = users.findIndex((item) => normalizeEmail(item.email) === normalizeEmail(cachedSession.email));
        if (userIndex === -1) {
          feedback.textContent = "Nao foi possivel localizar essa conta local.";
          feedback.className = "feedback error";
          return;
        }

        users[userIndex] = {
          ...users[userIndex],
          password,
          firstAccessPending: false
        };
        writeJson(LOCAL_USERS_KEY, users);
        cachedSession = users[userIndex];
        saveLocalSession(cachedSession);
      }

      feedback.textContent = "Senha criada com sucesso. Redirecionando para o painel...";
      feedback.className = "feedback success";

      setTimeout(function () {
        window.location.href = "dashboard.html";
      }, 500);
    });

    logoutButton?.addEventListener("click", async function () {
      await clearSession();
      window.location.href = "../index.html";
    });
  }

  async function protectPage() {
    const session = await loadSupabaseSession();
    if (!session) {
      window.location.href = loginPath();
      return null;
    }

    if (session.firstAccessPending && !isFirstAccessPage()) {
      window.location.href = firstAccessPath();
      return null;
    }

    const pageRoles = document.body.dataset.roles || "all";
    if (!roleCanAccessPage(session.role, pageRoles)) {
      window.location.href = dashboardPath();
      return null;
    }

    return session;
  }

  function provisionResponsibleAccess(record, options) {
    const normalizedEmail = normalizeEmail(record.email);
    if (!normalizedEmail) {
      return { ok: false, error: "Informe um e-mail valido para o responsavel." };
    }

    const previousRecord = options?.previousRecord || null;
    const users = getLocalUsers();
    const duplicateUser = users.find((user) => normalizeEmail(user.email) === normalizedEmail && user.role !== "responsaveis");
    if (duplicateUser) {
      return { ok: false, error: "Este e-mail ja esta em uso em outro perfil do sistema." };
    }

    const existingResponsibleUser = users.find((user) => normalizeEmail(user.email) === normalizedEmail && user.role === "responsaveis");
    const temporaryPassword = `gama${Math.floor(100000 + Math.random() * 900000)}!`;
    const nextUser = existingResponsibleUser || {
      name: record.nome,
      email: normalizedEmail,
      role: "responsaveis",
      roleLabel: "Responsavel",
      canApprove: false,
      password: temporaryPassword,
      firstAccessPending: true
    };

    const nextUsers = users.filter((user) => normalizeEmail(user.email) !== normalizedEmail);
    nextUsers.unshift({
      ...nextUser,
      name: record.nome,
      email: normalizedEmail
    });
    writeJson(LOCAL_USERS_KEY, nextUsers);

    return {
      ok: true,
      user: { ...nextUser, name: record.nome, email: normalizedEmail },
      accessStatus: nextUser.firstAccessPending ? "Convite pendente" : "Acesso ativo",
      notice: {
        to: normalizedEmail,
        deliveryStatus: "registrada-no-sistema",
        title: "Acesso preparado em modo local",
        body: `Conta local criada para ${record.nome}. Senha temporaria: ${temporaryPassword}`
      }
    };
  }

  function removeResponsibleAccess(email, remainingRecords) {
    const normalizedEmail = normalizeEmail(email);
    const stillInUse = (remainingRecords || []).some((item) => normalizeEmail(item.email) === normalizedEmail);
    if (stillInUse) return;

    const nextUsers = getLocalUsers().filter((user) => !(user.role === "responsaveis" && normalizeEmail(user.email) === normalizedEmail));
    writeJson(LOCAL_USERS_KEY, nextUsers);

    if (cachedSession && normalizeEmail(cachedSession.email) === normalizedEmail) {
      clearLocalSession();
    }
  }

  window.AgendaGamaAuth = {
    mountLogin,
    mountFirstAccess,
    protectPage,
    getSession,
    clearSession,
    getUsers,
    provisionResponsibleAccess,
    removeResponsibleAccess,
    isSupabaseEnabled
  };
})();
