(function () {
  const DEFAULT_DIRECTORY = {
    turmas: [
      { id: "turma-demo-1", nome: "1o Ano A", turno: "Manha", sala: "Sala 01", ano: "2026" },
      { id: "turma-demo-2", nome: "5o Ano B", turno: "Tarde", sala: "Sala 08", ano: "2026" }
    ],
    responsaveis: [
      { id: "resp-demo-1", nome: "Mariana Alves", parentesco: "Mae", aluno: "Ana Clara Silva", contato: "(11) 99999-2201", email: "responsavel@gama.edu.br", access_status: "Acesso ativo" },
      { id: "resp-demo-2", nome: "Renato Henrique", parentesco: "Pai", aluno: "Pedro Henrique", contato: "(11) 99999-2202", email: "renato.henrique@gama.edu.br", access_status: "Convite enviado" }
    ],
    professores: [
      { id: "prof-demo-1", nome: "Helena Souza", disciplinas: "Ciencias", turno: "Manha", email: "helena@agendagama.com" },
      { id: "prof-demo-2", nome: "Ricardo Lima", disciplinas: "Portugues", turno: "Tarde", email: "ricardo@agendagama.com" }
    ],
    equipe: [
      { id: "equipe-demo-1", nome: "Lucia Mendes", cargo: "Diretor", setor: "Direcao", contato: "(11) 99999-1001" },
      { id: "equipe-demo-2", nome: "Rafael Costa", cargo: "Secretario", setor: "Secretaria", contato: "(11) 99999-1002" }
    ]
  };

  const DEFAULT_CHANNELS = [
    {
      id: "canal-geral",
      nome: "Comunicados Gerais",
      publico: "Escola",
      descricao: "Avisos institucionais e comunicados oficiais aprovados pela gestao.",
      created_by_name: "Amanda Gama",
      created_at: "2026-04-15 08:30"
    },
    {
      id: "canal-pedagogico",
      nome: "Rotina Pedagogica",
      publico: "Equipe docente",
      descricao: "Canal para recados de sala, reunioes e alinhamentos do calendario escolar.",
      created_by_name: "Amanda Gama",
      created_at: "2026-04-15 09:00"
    }
  ];

  const DEFAULT_MESSAGES = [
    {
      id: "msg-1",
      canal_id: "canal-geral",
      canal_nome: "Comunicados Gerais",
      sender_name: "Carlos Secretaria",
      sender_email: "funcionario@gama.edu.br",
      sender_role: "funcionarios",
      recipient_type: "responsaveis",
      recipients: ["Mariana Alves"],
      subject: "Atualizacao de documentacao escolar",
      content: "Favor confirmar o envio da copia atualizada do RG do aluno na secretaria ate sexta-feira.",
      status: "pendente de aprovacao",
      created_at: "2026-04-15 09:20",
      approved_by: "",
      sent_by: ""
    },
    {
      id: "msg-2",
      canal_id: "canal-pedagogico",
      canal_nome: "Rotina Pedagogica",
      sender_name: "Mariana Alves",
      sender_email: "responsavel@gama.edu.br",
      sender_role: "responsaveis",
      recipient_type: "professores",
      recipients: ["Prof. Helena Souza"],
      subject: "Duvida sobre tarefa de ciencias",
      content: "Gostaria de confirmar se a atividade pratica deve ser entregue impressa ou manuscrita.",
      status: "enviada",
      created_at: "2026-04-15 10:05",
      approved_by: "",
      sent_by: "Mariana Alves"
    }
  ];

  function generateId(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function nowLabel() {
    return new Date().toISOString();
  }

  function formatDate(value) {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value || "-";
    }

    return parsedDate.toLocaleString("pt-BR");
  }

  function getRecipientModes(role) {
    if (role === "professores" || role === "funcionarios") {
      return [
        { value: "turmas", label: "Turma inteira" },
        { value: "responsaveis", label: "Um ou mais responsaveis" }
      ];
    }

    if (role === "responsaveis") {
      return [
        { value: "funcionarios", label: "Funcionarios" },
        { value: "professores", label: "Professores" }
      ];
    }

    return [];
  }

  function getStatusClass(status) {
    if (status === "pendente de aprovacao") return "status-pendente";
    if (status === "aprovada") return "status-aprovada";
    if (status === "enviada") return "status-enviada";
    return "status-rascunho";
  }

  function getStatusLabel(status) {
    if (status === "pendente de aprovacao") return "Pendente de aprovacao";
    if (status === "aprovada") return "Aprovada";
    if (status === "enviada") return "Enviada";
    return "Rascunho";
  }

  function canCreateChannels(role) {
    return role === "administrador" || role === "funcionarios" || role === "professores";
  }

  function canCompose(role) {
    return role === "funcionarios" || role === "professores" || role === "responsaveis";
  }

  function getInitialStatus(role, action) {
    if (action === "draft") return "rascunho";
    if (role === "responsaveis") return "enviada";
    return "pendente de aprovacao";
  }

  function isRelevantMessage(message, session) {
    if (session.canApprove) return true;
    if (message.sender_email === session.email) return true;

    if (session.role === "responsaveis") {
      return message.recipient_type === "responsaveis" && message.recipients.includes(session.name);
    }

    if (session.role === "professores" || session.role === "funcionarios") {
      return message.recipient_type === session.role && message.recipients.includes(session.name);
    }

    return false;
  }

  function ensureShellContent(callback) {
    if (document.getElementById("message-list")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  async function mountCommunication() {
    ensureShellContent(async function () {
      const session = window.AgendaGamaAuth.getSession();
      if (!session) return;

      const channelForm = document.getElementById("channel-form");
      const composeForm = document.getElementById("message-form");
      const channelList = document.getElementById("channel-list");
      const channelTotal = document.getElementById("channels-total");
      const messageList = document.getElementById("message-list");
      const approvalList = document.getElementById("approval-list");
      const approvalPanel = document.getElementById("approval-panel");
      const feedback = document.getElementById("message-feedback");
      const channelFeedback = document.getElementById("channel-feedback");
      const recipientType = document.getElementById("recipient-type");
      const recipients = document.getElementById("recipients");
      const recipientsHint = document.getElementById("recipients-hint");
      const channelSelect = document.getElementById("channel-id");
      const composerPanel = document.getElementById("compose-panel");
      const channelPanel = document.getElementById("channel-form-panel");
      const statusDraft = document.getElementById("status-rascunho");
      const statusPending = document.getElementById("status-pendente");
      const statusApproved = document.getElementById("status-aprovada");
      const statusSent = document.getElementById("status-enviada");
      const composerHint = document.getElementById("compose-hint");

      let directory = null;
      let channels = [];
      let messages = [];

      async function loadData() {
        const [turmas, responsaveis, professores, equipe, loadedChannels, loadedMessages] = await Promise.all([
          window.AgendaGamaDataStore.list("turmas", DEFAULT_DIRECTORY.turmas),
          window.AgendaGamaDataStore.list("responsaveis", DEFAULT_DIRECTORY.responsaveis),
          window.AgendaGamaDataStore.list("professores", DEFAULT_DIRECTORY.professores),
          window.AgendaGamaDataStore.list("equipe", DEFAULT_DIRECTORY.equipe),
          window.AgendaGamaDataStore.list("channels", DEFAULT_CHANNELS),
          window.AgendaGamaDataStore.list("messages", DEFAULT_MESSAGES)
        ]);

        directory = { turmas, responsaveis, professores, equipe };
        channels = loadedChannels;
        messages = loadedMessages;
      }

      function getRecipientOptions(type) {
        const authUsers = window.AgendaGamaAuth.getUsers();

        if (type === "turmas") {
          return directory.turmas.map((item) => ({ value: item.nome, label: `${item.nome} - ${item.turno}` }));
        }

        if (type === "responsaveis") {
          return directory.responsaveis.map((item) => ({ value: item.nome, label: `${item.nome} - ${item.aluno}` }));
        }

        if (type === "professores") {
          return authUsers
            .filter((item) => item.role === "professores")
            .map((item) => ({ value: item.name, label: `${item.name} - ${item.roleLabel}` }));
        }

        if (type === "funcionarios") {
          return authUsers
            .filter((item) => item.role === "funcionarios")
            .map((item) => ({ value: item.name, label: `${item.name} - ${item.roleLabel}` }));
        }

        return [];
      }

      function renderChannelSelect() {
        channelSelect.innerHTML = channels.map((channel) => (
          `<option value="${channel.id}">${channel.nome}</option>`
        )).join("");
      }

      function renderChannels() {
        channelTotal.textContent = String(channels.length).padStart(2, "0");
        channelList.innerHTML = channels.map((channel) => `
          <article class="channel-card">
            <div class="card-head">
              <h3 class="card-title">${channel.nome}</h3>
              <span class="tag">${channel.publico}</span>
            </div>
            <p>${channel.descricao}</p>
            <div class="divider"></div>
            <p class="meta-line">Criado por ${channel.created_by_name} em ${formatDate(channel.created_at)}</p>
          </article>
        `).join("");
        renderChannelSelect();
      }

      function renderRecipientOptions() {
        const modes = getRecipientModes(session.role);
        if (!modes.length) {
          return;
        }

        recipientType.innerHTML = modes.map((mode) => (
          `<option value="${mode.value}">${mode.label}</option>`
        )).join("");

        if (!recipientType.value) {
          recipientType.value = modes[0].value;
        }

        const options = getRecipientOptions(recipientType.value);
        recipients.innerHTML = options.map((option) => (
          `<option value="${option.value}">${option.label}</option>`
        )).join("");
        recipients.size = Math.min(Math.max(options.length, 3), 6);

        if (recipientType.value === "turmas") {
          recipientsHint.textContent = "Professores e funcionarios podem selecionar uma ou mais turmas para envio coletivo.";
        } else if (recipientType.value === "responsaveis") {
          recipientsHint.textContent = "Selecione um ou mais responsaveis para envio direcionado.";
        } else {
          recipientsHint.textContent = "Responsaveis podem falar apenas com funcionarios e professores.";
        }
      }

      function renderStats() {
        statusDraft.textContent = String(messages.filter((item) => item.status === "rascunho").length).padStart(2, "0");
        statusPending.textContent = String(messages.filter((item) => item.status === "pendente de aprovacao").length).padStart(2, "0");
        statusApproved.textContent = String(messages.filter((item) => item.status === "aprovada").length).padStart(2, "0");
        statusSent.textContent = String(messages.filter((item) => item.status === "enviada").length).padStart(2, "0");
      }

      function renderMessages() {
        const visibleMessages = messages.filter((message) => isRelevantMessage(message, session));

        messageList.innerHTML = visibleMessages.length ? visibleMessages.map((message) => `
          <article class="message-card">
            <div class="message-head">
              <div>
                <h3 class="message-title">${message.subject}</h3>
                <p>${message.sender_name} -> ${message.recipients.join(", ")}</p>
              </div>
              <span class="status-badge ${getStatusClass(message.status)}">${getStatusLabel(message.status)}</span>
            </div>
            <div class="inline-tags" style="margin-top: 12px;">
              <span class="tag">${message.canal_nome}</span>
              <span class="tag">${message.recipient_type}</span>
            </div>
            <p style="margin-top: 12px;">${message.content}</p>
            <div class="divider"></div>
            <p class="meta-line">Criada em ${formatDate(message.created_at)}${message.approved_by ? ` | Aprovada por ${message.approved_by}` : ""}${message.sent_by ? ` | Enviada por ${message.sent_by}` : ""}</p>
          </article>
        `).join("") : '<p class="empty-state">Nenhuma mensagem visivel para este perfil.</p>';

        if (!session.canApprove) {
          approvalPanel.hidden = true;
          return;
        }

        approvalPanel.hidden = false;
        const approvalItems = messages.filter((message) => (
          message.status === "pendente de aprovacao" || message.status === "aprovada"
        ));

        approvalList.innerHTML = approvalItems.length ? approvalItems.map((message) => `
          <article class="message-card">
            <div class="message-head">
              <div>
                <h3 class="message-title">${message.subject}</h3>
                <p>${message.sender_name} -> ${message.recipients.join(", ")}</p>
              </div>
              <span class="status-badge ${getStatusClass(message.status)}">${getStatusLabel(message.status)}</span>
            </div>
            <p style="margin-top: 12px;">${message.content}</p>
            <div class="message-actions">
              ${message.status === "pendente de aprovacao" ? `<button class="btn btn-secondary approval-action" data-action="approve" data-id="${message.id}">Aprovar</button>` : ""}
              ${message.status === "aprovada" ? `<button class="btn btn-primary approval-action" data-action="send" data-id="${message.id}">Enviar</button>` : ""}
            </div>
          </article>
        `).join("") : '<p class="empty-state">Nenhuma mensagem aguardando acao de aprovacao.</p>';
      }

      async function refreshAll() {
        await loadData();
        renderChannels();
        renderRecipientOptions();
        renderStats();
        renderMessages();
      }

      if (!canCreateChannels(session.role)) {
        channelPanel.innerHTML = `
          <div class="hint-box">
            <p>Este perfil pode acompanhar os canais existentes, mas a criacao de novos canais fica disponivel para administracao, professores e funcionarios.</p>
          </div>
        `;
      }

      if (!canCompose(session.role)) {
        composerPanel.innerHTML = `
          <div class="hint-box">
            <p>Este perfil atua na aprovacao das mensagens. Professores, funcionarios e responsaveis utilizam o formulario de composicao.</p>
          </div>
        `;
      } else {
        composerHint.textContent = session.role === "responsaveis"
          ? "Responsaveis podem enviar apenas para funcionarios e professores, sem contato com outros responsaveis."
          : "Mensagens de professores e funcionarios saem do rascunho para a fila de aprovacao antes do envio final.";
      }

      channelForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(channelForm).entries());

        await window.AgendaGamaDataStore.save("channels", {
          nome: data.nome,
          publico: data.publico,
          descricao: data.descricao,
          created_by_name: session.name,
          created_at: nowLabel()
        }, DEFAULT_CHANNELS);

        channelForm.reset();
        channelFeedback.textContent = "Canal criado com sucesso.";
        channelFeedback.className = "feedback success";
        await refreshAll();
      });

      recipientType?.addEventListener("change", renderRecipientOptions);

      composeForm?.addEventListener("submit", async function (event) {
        event.preventDefault();

        const action = event.submitter ? event.submitter.value : "draft";
        const formData = new FormData(composeForm);
        const selectedRecipients = Array.from(recipients.selectedOptions).map((option) => option.value);

        if (!selectedRecipients.length) {
          feedback.textContent = "Selecione pelo menos um destinatario para continuar.";
          feedback.className = "feedback error";
          return;
        }

        const chosenType = String(formData.get("recipientType") || "");
        const allowedTypes = getRecipientModes(session.role).map((item) => item.value);
        if (!allowedTypes.includes(chosenType)) {
          feedback.textContent = "Este perfil nao pode usar esse tipo de destinatario.";
          feedback.className = "feedback error";
          return;
        }

        const selectedChannel = channels.find((channel) => channel.id === formData.get("channelId"));

        await window.AgendaGamaDataStore.save("messages", {
          canal_id: selectedChannel ? selectedChannel.id : null,
          canal_nome: selectedChannel ? selectedChannel.nome : "Sem canal",
          sender_name: session.name,
          sender_email: session.email,
          sender_role: session.role,
          recipient_type: chosenType,
          recipients: selectedRecipients,
          subject: String(formData.get("subject") || ""),
          content: String(formData.get("content") || ""),
          status: getInitialStatus(session.role, action),
          created_at: nowLabel(),
          approved_by: "",
          sent_by: session.role === "responsaveis" && action !== "draft" ? session.name : ""
        }, DEFAULT_MESSAGES);

        composeForm.reset();
        feedback.textContent = action === "draft"
          ? "Mensagem salva como rascunho."
          : session.role === "responsaveis"
            ? "Mensagem enviada com sucesso."
            : "Mensagem enviada para aprovacao.";
        feedback.className = "feedback success";
        await refreshAll();
      });

      approvalList?.addEventListener("click", async function (event) {
        const button = event.target.closest(".approval-action");
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;
        const message = messages.find((item) => item.id === id);
        if (!message) return;

        if (action === "approve") {
          message.status = "aprovada";
          message.approved_by = session.name;
        }

        if (action === "send") {
          message.status = "enviada";
          message.sent_by = session.name;
        }

        await window.AgendaGamaDataStore.save("messages", message, DEFAULT_MESSAGES);
        await refreshAll();
      });

      await refreshAll();
    });
  }

  window.AgendaGamaCommunication = { mountCommunication };
})();
