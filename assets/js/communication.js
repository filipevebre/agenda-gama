(function () {
  const DEFAULT_DIRECTORY = {
    turmas: [
      { id: "turma-demo-1", nome: "1o Ano A", turno: "Manha", sala: "Sala 01", ano: "2026" },
      { id: "turma-demo-2", nome: "5o Ano B", turno: "Tarde", sala: "Sala 08", ano: "2026" }
    ],
    alunos: [
      { id: "aluno-demo-1", nome: "Ana Clara Silva", matricula: "2026001", turma: "1o Ano A", turno: "Manha" },
      { id: "aluno-demo-2", nome: "Pedro Henrique", matricula: "2026002", turma: "5o Ano B", turno: "Tarde" }
    ],
    responsaveis: [
      {
        id: "resp-demo-1",
        nome: "Mariana Alves",
        parentesco: "Mae",
        aluno_id: "aluno-demo-1",
        aluno: "Ana Clara Silva",
        contato: "(11) 99999-2201",
        email: "responsavel@gama.edu.br",
        access_status: "Acesso ativo"
      },
      {
        id: "resp-demo-2",
        nome: "Renato Henrique",
        parentesco: "Pai",
        aluno_id: "aluno-demo-2",
        aluno: "Pedro Henrique",
        contato: "(11) 99999-2202",
        email: "renato.henrique@gama.edu.br",
        access_status: "Convite enviado"
      }
    ],
    professores: [
      { id: "prof-demo-1", nome: "Helena Souza", disciplinas: "Ciencias", turno: "Manha", email: "helena@agendagama.com" },
      { id: "prof-demo-2", nome: "Ricardo Lima", disciplinas: "Portugues", turno: "Tarde", email: "ricardo@agendagama.com" }
    ],
    equipe: [
      { id: "equipe-demo-1", nome: "Lucia Mendes", cargo: "Diretora", setor: "Direcao", contato: "(11) 99999-1001", email: "direcao@gama.edu.br" },
      { id: "equipe-demo-2", nome: "Rafael Costa", cargo: "Secretario", setor: "Secretaria", contato: "(11) 99999-1002", email: "secretaria@gama.edu.br" }
    ]
  };

  const DEFAULT_CHANNELS = [
    {
      id: "canal-demo-1",
      nome: "Turma 1o Ano A",
      publico: "1o Ano A",
      descricao: "Canal da turma para avisos gerais e conversa com a escola.",
      created_by_name: "Amanda Gama",
      created_at: "2026-04-15T08:30:00.000Z"
    },
    {
      id: "canal-demo-2",
      nome: "Turma 5o Ano B",
      publico: "5o Ano B",
      descricao: "Canal da turma para rotina escolar, recados e atendimento da familia.",
      created_by_name: "Amanda Gama",
      created_at: "2026-04-15T09:00:00.000Z"
    }
  ];

  const DEFAULT_MESSAGES = [
    {
      id: "msg-demo-1",
      canal_id: "canal-demo-1",
      canal_nome: "Turma 1o Ano A",
      sender_name: "Carlos Secretaria",
      sender_email: "funcionario@gama.edu.br",
      sender_role: "funcionarios",
      recipient_type: "turmas",
      recipients: ["1o Ano A"],
      subject: "Mural da turma - Turma 1o Ano A",
      content: "A reuniao de pais da turma sera na quinta-feira, as 18h30, no auditorio.",
      status: "enviada",
      approved_by: "Amanda Gama",
      sent_by: "Amanda Gama",
      created_at: "2026-04-15T10:20:00.000Z"
    },
    {
      id: "msg-demo-2",
      canal_id: "canal-demo-1",
      canal_nome: "Turma 1o Ano A",
      sender_name: "Mariana Alves",
      sender_email: "responsavel@gama.edu.br",
      sender_role: "responsaveis",
      recipient_type: "escola",
      recipients: ["escola"],
      subject: "Conversa com a escola - Turma 1o Ano A",
      content: "Bom dia. Gostaria de saber se a agenda digital ja esta valendo para os bilhetes do 1o ano.",
      status: "enviada",
      approved_by: "",
      sent_by: "Mariana Alves",
      created_at: "2026-04-15T10:45:00.000Z"
    },
    {
      id: "msg-demo-3",
      canal_id: "canal-demo-1",
      canal_nome: "Turma 1o Ano A",
      sender_name: "Lucia Mendes",
      sender_email: "direcao@gama.edu.br",
      sender_role: "funcionarios",
      recipient_type: "responsaveis",
      recipients: ["responsavel@gama.edu.br"],
      subject: "Conversa com a escola - Turma 1o Ano A",
      content: "Sim. A partir desta semana os comunicados de rotina e os retornos da familia podem ser feitos por aqui.",
      status: "enviada",
      approved_by: "Amanda Gama",
      sent_by: "Amanda Gama",
      created_at: "2026-04-15T11:05:00.000Z"
    }
  ];

  let refreshTimer = null;
  let storageListenerAttached = false;

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeEmail(value) {
    return normalizeText(value);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function sortByCreatedAsc(items) {
    return [...(items || [])].sort(function (left, right) {
      return new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime();
    });
  }

  function formatShortTimestamp(value) {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value || "-";
    }

    const now = new Date();
    const sameDay = parsedDate.toDateString() === now.toDateString();
    if (sameDay) {
      return parsedDate.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (parsedDate.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    }

    return parsedDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit"
    });
  }

  function getInitials(name) {
    return String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part[0]; })
      .join("")
      .toUpperCase() || "AG";
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

  function ensureShellContent(callback) {
    if (document.getElementById("conversation-list")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function canCreateChannels(role) {
    return role === "administrador" || role === "funcionarios" || role === "professores";
  }

  function canPostInRoom(session, roomId) {
    if (!session) return false;

    if (roomId === "mural") {
      return session.role === "administrador" || session.role === "funcionarios" || session.role === "professores";
    }

    return true;
  }

  function getRoomLabel(roomId) {
    return roomId === "mural" ? "Avisos da turma" : "Conversa com a escola";
  }

  function getRoomDescription(roomId, session) {
    if (roomId === "mural") {
      return session.role === "responsaveis"
        ? "Mural de avisos gerais da turma. O responsavel acompanha, mas nao responde por aqui."
        : "Envie avisos gerais para toda a turma. As mensagens de professores e funcionarios seguem o fluxo de aprovacao.";
    }

    if (session.role === "responsaveis") {
      return "Conversa direta com a escola. Sua familia pode escrever aqui e acompanhar as respostas.";
    }

    return "Conversa com as familias. Voce pode enviar para todos os responsaveis da turma ou selecionar mais de um responsavel.";
  }

  function getChannelTurma(channel) {
    return String(channel?.publico || "").trim();
  }

  function buildResponsibleMap(responsaveis) {
    const byEmail = new Map();
    const byName = new Map();

    (responsaveis || []).forEach(function (item) {
      if (item.email) {
        byEmail.set(normalizeEmail(item.email), item);
      }

      if (item.nome) {
        byName.set(normalizeText(item.nome), item);
      }
    });

    return { byEmail, byName };
  }

  function resolveResponsibleLabel(token, responsibleMap) {
    const normalizedToken = normalizeText(token);
    const byEmail = responsibleMap.byEmail.get(normalizedToken);
    if (byEmail) {
      return byEmail.nome;
    }

    const byName = responsibleMap.byName.get(normalizedToken);
    if (byName) {
      return byName.nome;
    }

    return token;
  }

  function getChannelResponsaveis(directory, channel) {
    const turmaName = normalizeText(getChannelTurma(channel));
    const alunosMap = new Map((directory.alunos || []).map(function (item) {
      return [item.id, item];
    }));

    return (directory.responsaveis || []).filter(function (item) {
      const aluno = item.aluno_id ? alunosMap.get(item.aluno_id) : null;
      const turmaByAlunoId = aluno ? normalizeText(aluno.turma) : "";

      if (turmaByAlunoId && turmaByAlunoId === turmaName) {
        return true;
      }

      if (item.aluno) {
        const alunoByName = (directory.alunos || []).find(function (candidate) {
          return normalizeText(candidate.nome) === normalizeText(item.aluno);
        });

        if (alunoByName && normalizeText(alunoByName.turma) === turmaName) {
          return true;
        }
      }

      return false;
    });
  }

  function getVisibleChannels(directory, channels, session) {
    if (session.role !== "responsaveis") {
      return [...channels].sort(function (left, right) {
        return String(left.nome || "").localeCompare(String(right.nome || ""), "pt-BR");
      });
    }

    const responsavelRecords = (directory.responsaveis || []).filter(function (item) {
      return normalizeEmail(item.email) === normalizeEmail(session.email);
    });

    const alunosMap = new Map((directory.alunos || []).map(function (item) {
      return [item.id, item];
    }));
    const turmas = new Set();

    responsavelRecords.forEach(function (item) {
      const aluno = item.aluno_id ? alunosMap.get(item.aluno_id) : null;
      if (aluno?.turma) {
        turmas.add(normalizeText(aluno.turma));
      } else if (item.aluno) {
        const alunoByName = (directory.alunos || []).find(function (candidate) {
          return normalizeText(candidate.nome) === normalizeText(item.aluno);
        });

        if (alunoByName?.turma) {
          turmas.add(normalizeText(alunoByName.turma));
        }
      }
    });

    return channels
      .filter(function (channel) {
        return turmas.has(normalizeText(getChannelTurma(channel)));
      })
      .sort(function (left, right) {
        return String(left.nome || "").localeCompare(String(right.nome || ""), "pt-BR");
      });
  }

  function messageBelongsToConversation(message, channel, roomId) {
    if (!message || message.canal_id !== channel.id) {
      return false;
    }

    if (roomId === "mural") {
      return message.recipient_type === "turmas";
    }

    return message.recipient_type !== "turmas";
  }

  function canInspectPrivateStatus(message, session) {
    return session.canApprove || normalizeEmail(message.sender_email) === normalizeEmail(session.email);
  }

  function isRecipientForResponsible(message, session, responsibleMap) {
    const recipients = Array.isArray(message.recipients) ? message.recipients : [];
    const sessionEmail = normalizeEmail(session.email);
    const sessionName = normalizeText(session.name);

    return recipients.some(function (token) {
      const normalizedToken = normalizeText(token);
      if (!normalizedToken) return false;
      if (normalizedToken === sessionEmail || normalizedToken === sessionName) {
        return true;
      }

      const mappedResponsible = responsibleMap.byEmail.get(normalizedToken) || responsibleMap.byName.get(normalizedToken);
      return Boolean(mappedResponsible && normalizeEmail(mappedResponsible.email) === sessionEmail);
    });
  }

  function isVisibleMessage(message, conversation, session, responsibleMap) {
    if (!messageBelongsToConversation(message, conversation.channel, conversation.roomId)) {
      return false;
    }

    if (message.status !== "enviada" && !canInspectPrivateStatus(message, session)) {
      return false;
    }

    if (session.role === "responsaveis" && conversation.roomId === "escola") {
      return normalizeEmail(message.sender_email) === normalizeEmail(session.email)
        || isRecipientForResponsible(message, session, responsibleMap);
    }

    return true;
  }

  function getConversationMessages(messages, conversation, session, responsibleMap) {
    return sortByCreatedAsc(messages.filter(function (message) {
      return isVisibleMessage(message, conversation, session, responsibleMap);
    }));
  }

  function buildConversation(channel, roomId, messages, session, directory, responsibleMap) {
    const visibleMessages = getConversationMessages(messages, { channel, roomId }, session, responsibleMap);
    const actionableMessages = visibleMessages.filter(function (message) {
      return message.status === "pendente de aprovacao" || message.status === "aprovada";
    });
    const lastMessage = visibleMessages[visibleMessages.length - 1] || null;

    return {
      id: `${channel.id}:${roomId}`,
      channel: channel,
      roomId: roomId,
      title: getRoomLabel(roomId),
      subtitle: getChannelTurma(channel),
      canCompose: canPostInRoom(session, roomId),
      messageCount: visibleMessages.length,
      actionableCount: actionableMessages.length,
      pendingCount: visibleMessages.filter(function (message) {
        return message.status === "pendente de aprovacao";
      }).length,
      lastMessage: lastMessage,
      responsaveis: getChannelResponsaveis(directory, channel)
    };
  }

  function getConversationSet(channel, messages, session, directory, responsibleMap) {
    return [
      buildConversation(channel, "mural", messages, session, directory, responsibleMap),
      buildConversation(channel, "escola", messages, session, directory, responsibleMap)
    ];
  }

  function getFilteredConversations(conversations, filter, session) {
    if (filter === "aprovar") {
      if (!session.canApprove) {
        return [];
      }

      return conversations.filter(function (conversation) {
        return conversation.actionableCount > 0;
      });
    }

    if (filter === "responder") {
      return conversations.filter(function (conversation) {
        return conversation.canCompose;
      });
    }

    return conversations;
  }

  function getConversationPreview(conversation) {
    if (!conversation.lastMessage) {
      return "Nenhuma mensagem ainda.";
    }

    return conversation.lastMessage.content || "Sem conteudo.";
  }

  function getConversationBadgeCount(conversation, filter) {
    if (filter === "aprovar") {
      return conversation.actionableCount;
    }

    return conversation.messageCount;
  }

  function getMessageRecipientLabel(message, conversation, responsibleMap) {
    if (conversation.roomId === "mural") {
      return "Para toda a turma";
    }

    if (message.recipient_type === "escola") {
      return "Para a escola";
    }

    const recipients = Array.isArray(message.recipients) ? message.recipients : [];
    if (!recipients.length) {
      return "Destinatarios nao informados";
    }

    const labels = recipients.map(function (token) {
      return resolveResponsibleLabel(token, responsibleMap);
    });

    if (labels.length <= 2) {
      return `Para ${labels.join(", ")}`;
    }

    return `Para ${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function mountCommunication() {
    ensureShellContent(async function () {
      const session = window.AgendaGamaAuth.getSession();
      if (!session) return;

      const channelSearch = document.getElementById("channel-search");
      const channelButtonList = document.getElementById("channel-button-list");
      const channelEmpty = document.getElementById("channel-empty");
      const channelsTotal = document.getElementById("channels-total");
      const channelFormPanel = document.getElementById("channel-form-panel");
      const channelForm = document.getElementById("channel-form");
      const channelFeedback = document.getElementById("channel-feedback");
      const channelTurma = document.getElementById("channel-turma");
      const toggleChannelForm = document.getElementById("toggle-channel-form");
      const quickOpenChat = document.getElementById("quick-open-chat");
      const conversationList = document.getElementById("conversation-list");
      const threadHeader = document.getElementById("thread-header");
      const threadMeta = document.getElementById("thread-meta");
      const threadBody = document.getElementById("thread-body");
      const composerPanel = document.getElementById("thread-composer-panel");
      const chatForm = document.getElementById("chat-form");
      const chatFeedback = document.getElementById("chat-feedback");
      const chatInput = document.getElementById("chat-message-input");
      const chatActions = document.getElementById("chat-actions");
      const staffTargetPanel = document.getElementById("staff-target-panel");
      const staffTargetMode = document.getElementById("staff-target-mode");
      const staffTargetListField = document.getElementById("staff-target-list-field");
      const staffTargetList = document.getElementById("staff-target-list");
      const targetHint = document.getElementById("target-hint");
      const filterButtons = Array.from(document.querySelectorAll(".conversation-filter"));
      const statusDraft = document.getElementById("status-rascunho");
      const statusPending = document.getElementById("status-pendente");
      const statusApproved = document.getElementById("status-aprovada");
      const statusSent = document.getElementById("status-enviada");
      const filterCountResponder = document.getElementById("filter-count-responder");
      const filterCountAprovar = document.getElementById("filter-count-aprovar");
      const filterCountTodas = document.getElementById("filter-count-todas");

      const state = {
        directory: null,
        channels: [],
        messages: [],
        visibleChannels: [],
        activeChannelId: null,
        activeConversationId: null,
        activeFilter: "responder",
        searchTerm: "",
        responsibleMap: buildResponsibleMap([]),
        draftState: {},
        refreshInFlight: false
      };

      function syncDraftFromInputs() {
        if (!state.activeConversationId) return;

        state.draftState[state.activeConversationId] = {
          content: String(chatInput?.value || ""),
          targetMode: String(staffTargetMode?.value || "geral"),
          targetRecipients: Array.from(staffTargetList?.selectedOptions || []).map(function (option) {
            return option.value;
          })
        };
      }

      async function loadData() {
        const [turmas, alunos, responsaveis, professores, equipe, loadedChannels, loadedMessages] = await Promise.all([
          window.AgendaGamaDataStore.list("turmas", DEFAULT_DIRECTORY.turmas),
          window.AgendaGamaDataStore.list("alunos", DEFAULT_DIRECTORY.alunos),
          window.AgendaGamaDataStore.list("responsaveis", DEFAULT_DIRECTORY.responsaveis),
          window.AgendaGamaDataStore.list("professores", DEFAULT_DIRECTORY.professores),
          window.AgendaGamaDataStore.list("equipe", DEFAULT_DIRECTORY.equipe),
          window.AgendaGamaDataStore.list("channels", DEFAULT_CHANNELS),
          window.AgendaGamaDataStore.list("messages", DEFAULT_MESSAGES)
        ]);

        state.directory = { turmas: turmas, alunos: alunos, responsaveis: responsaveis, professores: professores, equipe: equipe };
        state.channels = loadedChannels;
        state.messages = loadedMessages;
        state.responsibleMap = buildResponsibleMap(responsaveis);
        state.visibleChannels = getVisibleChannels(state.directory, state.channels, session);

        if (!state.visibleChannels.some(function (channel) { return channel.id === state.activeChannelId; })) {
          state.activeChannelId = state.visibleChannels[0]?.id || null;
        }
      }

      function getActiveChannel() {
        return state.visibleChannels.find(function (channel) {
          return channel.id === state.activeChannelId;
        }) || null;
      }

      function getConversationsForActiveChannel() {
        const channel = getActiveChannel();
        if (!channel) return [];
        return getConversationSet(channel, state.messages, session, state.directory, state.responsibleMap);
      }

      function getActiveConversation() {
        const conversations = getConversationsForActiveChannel();
        const filteredConversations = getFilteredConversations(conversations, state.activeFilter, session);

        if (!filteredConversations.length) {
          state.activeConversationId = null;
        } else if (!filteredConversations.some(function (conversation) { return conversation.id === state.activeConversationId; })) {
          state.activeConversationId = filteredConversations[0]?.id || null;
        }

        return conversations.find(function (conversation) {
          return conversation.id === state.activeConversationId;
        }) || null;
      }

      function renderStatusCards() {
        const visibleMessages = state.messages.filter(function (message) {
          return state.visibleChannels.some(function (channel) {
            if (message.canal_id !== channel.id) return false;

            const roomId = message.recipient_type === "turmas" ? "mural" : "escola";
            return isVisibleMessage(message, { channel: channel, roomId: roomId }, session, state.responsibleMap);
          });
        });

        statusDraft.textContent = String(visibleMessages.filter(function (item) {
          return item.status === "rascunho";
        }).length).padStart(2, "0");
        statusPending.textContent = String(visibleMessages.filter(function (item) {
          return item.status === "pendente de aprovacao";
        }).length).padStart(2, "0");
        statusApproved.textContent = String(visibleMessages.filter(function (item) {
          return item.status === "aprovada";
        }).length).padStart(2, "0");
        statusSent.textContent = String(visibleMessages.filter(function (item) {
          return item.status === "enviada";
        }).length).padStart(2, "0");
      }

      function renderChannelForm() {
        const canCreate = canCreateChannels(session.role);
        if (toggleChannelForm) {
          toggleChannelForm.hidden = !canCreate;
        }

        if (!channelFormPanel) return;

        if (!canCreate) {
          channelFormPanel.hidden = true;
          return;
        }

        channelTurma.innerHTML = (state.directory.turmas || []).map(function (turma) {
          return `<option value="${escapeHtml(turma.nome)}">${escapeHtml(turma.nome)} - ${escapeHtml(turma.turno)}</option>`;
        }).join("");
      }

      function renderChannelList() {
        channelsTotal.textContent = String(state.visibleChannels.length).padStart(2, "0");
        const searchTerm = normalizeText(state.searchTerm);
        const filteredChannels = state.visibleChannels.filter(function (channel) {
          if (!searchTerm) return true;
          return normalizeText(channel.nome).includes(searchTerm) || normalizeText(getChannelTurma(channel)).includes(searchTerm);
        });

        if (!filteredChannels.some(function (channel) { return channel.id === state.activeChannelId; })) {
          state.activeChannelId = filteredChannels[0]?.id || state.visibleChannels[0]?.id || null;
        }

        channelEmpty.hidden = filteredChannels.length > 0;
        channelButtonList.innerHTML = filteredChannels.map(function (channel) {
          const channelMessages = state.messages.filter(function (message) {
            return message.canal_id === channel.id;
          }).filter(function (message) {
            const roomId = message.recipient_type === "turmas" ? "mural" : "escola";
            return isVisibleMessage(message, { channel: channel, roomId: roomId }, session, state.responsibleMap);
          });
          const badgeCount = channelMessages.filter(function (message) {
            return message.status === "pendente de aprovacao" || message.status === "aprovada";
          }).length || channelMessages.length;

          return `
            <button
              type="button"
              class="channel-card-button ${channel.id === state.activeChannelId ? "active" : ""}"
              data-channel-id="${escapeHtml(channel.id)}"
            >
              <span class="channel-card-avatar">${escapeHtml(getInitials(channel.nome))}</span>
              <span class="channel-card-copy">
                <strong>${escapeHtml(channel.nome)}</strong>
                <small>${escapeHtml(getChannelTurma(channel))}</small>
              </span>
              <span class="channel-card-count">${String(badgeCount).padStart(2, "0")}</span>
            </button>
          `;
        }).join("");
      }

      function renderFilterCounts(conversations) {
        filterCountResponder.textContent = String(getFilteredConversations(conversations, "responder", session).length);
        filterCountAprovar.textContent = String(getFilteredConversations(conversations, "aprovar", session).length);
        filterCountTodas.textContent = String(getFilteredConversations(conversations, "todas", session).length);

        filterButtons.forEach(function (button) {
          button.classList.toggle("active", button.dataset.filter === state.activeFilter);
        });
      }

      function renderConversationCards(conversations) {
        const filteredConversations = getFilteredConversations(conversations, state.activeFilter, session);
        renderFilterCounts(conversations);

        if (!filteredConversations.length) {
          state.activeConversationId = null;
        } else if (!filteredConversations.some(function (conversation) { return conversation.id === state.activeConversationId; })) {
          state.activeConversationId = filteredConversations[0]?.id || null;
        }

        conversationList.innerHTML = filteredConversations.length ? filteredConversations.map(function (conversation) {
          return `
            <button
              type="button"
              class="conversation-card ${conversation.id === state.activeConversationId ? "active" : ""}"
              data-conversation-id="${escapeHtml(conversation.id)}"
            >
              <span class="conversation-card-icon">${escapeHtml(conversation.roomId === "mural" ? "MU" : "ES")}</span>
              <span class="conversation-card-copy">
                <span class="conversation-card-topline">
                  <strong>${escapeHtml(conversation.title)}</strong>
                  <small>${escapeHtml(conversation.lastMessage ? formatShortTimestamp(conversation.lastMessage.created_at) : "")}</small>
                </span>
                <span class="conversation-card-meta">
                  <span class="tag">${escapeHtml(conversation.subtitle)}</span>
                  <span class="conversation-count">${String(getConversationBadgeCount(conversation, state.activeFilter)).padStart(2, "0")}</span>
                </span>
                <span class="conversation-card-preview">${escapeHtml(getConversationPreview(conversation))}</span>
              </span>
            </button>
          `;
        }).join("") : '<p class="empty-state">Nenhuma conversa nesse filtro.</p>';
      }

      function renderThreadHeader(conversation) {
        if (!conversation) {
          const currentChannel = getActiveChannel();
          threadHeader.innerHTML = `
            <div class="thread-title-block">
              <h2>${currentChannel ? "Nenhuma conversa nesse filtro" : "Selecione um canal"}</h2>
              <p>${currentChannel ? "Esse canal nao tem conversas na aba atual. Troque o filtro ou abra outra turma." : "Escolha um canal na lateral para ver o mural e a conversa com a escola."}</p>
            </div>
          `;
          threadMeta.hidden = true;
          return;
        }

        threadHeader.innerHTML = `
          <div class="thread-title-block">
            <span class="pill">${escapeHtml(conversation.channel.nome)}</span>
            <h2>${escapeHtml(conversation.title)}</h2>
            <p>${escapeHtml(getRoomDescription(conversation.roomId, session))}</p>
          </div>
          <div class="thread-title-aside">
            <span class="tag">${escapeHtml(conversation.subtitle)}</span>
            <strong>${String(conversation.messageCount).padStart(2, "0")} mensagens</strong>
          </div>
        `;

        const actionableLabel = conversation.actionableCount
          ? `${conversation.actionableCount} mensagem(ns) aguardando aprovacao ou envio.`
          : conversation.roomId === "mural"
            ? "Mural geral da turma."
            : "Chat da escola com a familia.";

        threadMeta.hidden = false;
        threadMeta.innerHTML = `
          <div class="thread-meta-grid">
            <span class="tag">${escapeHtml(conversation.roomId === "mural" ? "Somente leitura para responsaveis" : "Chat com resposta")}</span>
            <p>${escapeHtml(actionableLabel)}</p>
          </div>
        `;
      }

      function renderThreadMessages(conversation) {
        if (!conversation) {
          threadBody.innerHTML = '<p class="empty-state">Nenhuma conversa disponivel para exibir agora.</p>';
          return;
        }

        const visibleMessages = getConversationMessages(state.messages, conversation, session, state.responsibleMap);
        if (!visibleMessages.length) {
          threadBody.innerHTML = '<p class="empty-state">Ainda nao existem mensagens nessa conversa.</p>';
          return;
        }

        threadBody.innerHTML = visibleMessages.map(function (message) {
          const isMine = normalizeEmail(message.sender_email) === normalizeEmail(session.email);
          const statusBadge = message.status !== "enviada" || session.canApprove || isMine
            ? `<span class="status-badge ${getStatusClass(message.status)}">${getStatusLabel(message.status)}</span>`
            : "";
          const actionButtons = session.canApprove ? `
            <div class="message-actions compact-actions">
              ${message.status === "pendente de aprovacao" ? `<button type="button" class="btn btn-secondary approval-action" data-action="approve" data-id="${escapeHtml(message.id)}">Aprovar</button>` : ""}
              ${message.status === "aprovada" ? `<button type="button" class="btn btn-primary approval-action" data-action="send" data-id="${escapeHtml(message.id)}">Enviar</button>` : ""}
            </div>
          ` : "";

          return `
            <article class="chat-bubble ${isMine ? "mine" : ""} ${message.status !== "enviada" ? "pending" : ""}">
              <div class="chat-bubble-head">
                <span class="chat-avatar">${escapeHtml(getInitials(message.sender_name))}</span>
                <div class="chat-bubble-meta">
                  <div class="chat-meta-row">
                    <strong>${escapeHtml(message.sender_name)}</strong>
                    <span>${escapeHtml(formatShortTimestamp(message.created_at))}</span>
                  </div>
                  <div class="chat-meta-row secondary">
                    <span>${escapeHtml(getMessageRecipientLabel(message, conversation, state.responsibleMap))}</span>
                    ${statusBadge}
                  </div>
                </div>
              </div>
              <p>${escapeHtml(message.content)}</p>
              ${actionButtons}
            </article>
          `;
        }).join("");

        threadBody.scrollTop = threadBody.scrollHeight;
      }

      function renderComposer(conversation) {
        const canCompose = Boolean(conversation && canPostInRoom(session, conversation.roomId));
        composerPanel.hidden = !canCompose;

        if (!conversation || !canCompose) {
          if (chatFeedback) {
            chatFeedback.textContent = conversation && session.role === "responsaveis" && conversation.roomId === "mural"
              ? "O mural da turma e somente leitura para os responsaveis."
              : "";
            chatFeedback.className = chatFeedback.textContent ? "feedback success" : "feedback";
          }
          return;
        }

        const draft = state.draftState[conversation.id] || {
          content: "",
          targetMode: "geral",
          targetRecipients: []
        };

        chatInput.value = draft.content || "";
        if (staffTargetMode) {
          staffTargetMode.value = draft.targetMode || "geral";
        }

        const staffModeEnabled = conversation.roomId === "escola"
          && (session.role === "administrador" || session.role === "funcionarios" || session.role === "professores");

        staffTargetPanel.hidden = !staffModeEnabled;

        if (staffModeEnabled) {
          const responsaveis = conversation.responsaveis || [];
          staffTargetList.innerHTML = responsaveis.map(function (item) {
            return `<option value="${escapeHtml(item.email || item.nome)}">${escapeHtml(item.nome)} - ${escapeHtml(item.aluno || "Sem vinculo")}</option>`;
          }).join("");

          Array.from(staffTargetList.options).forEach(function (option) {
            option.selected = draft.targetRecipients.includes(option.value);
          });

          const showIndividualList = staffTargetMode.value === "individual";
          staffTargetListField.hidden = !showIndividualList;
          targetHint.textContent = showIndividualList
            ? "Selecione um ou mais responsaveis da turma para receber essa mensagem."
            : "Ao enviar em modo geral, todos os responsaveis da turma verao a mensagem.";
        } else {
          staffTargetList.innerHTML = "";
          staffTargetListField.hidden = true;
          targetHint.textContent = conversation.roomId === "mural"
            ? "Esse envio sera publicado para toda a turma."
            : session.role === "responsaveis"
              ? "Sua mensagem sera direcionada para a escola."
              : "";
        }

        chatActions.innerHTML = session.role === "responsaveis" ? `
          <button type="submit" class="btn btn-primary" value="send">Enviar mensagem</button>
        ` : `
          <button type="submit" class="btn btn-secondary" value="draft">Salvar rascunho</button>
          <button type="submit" class="btn btn-primary" value="send">${session.canApprove ? "Enviar agora" : "Enviar para aprovacao"}</button>
        `;
      }

      function renderAll() {
        renderChannelForm();
        renderChannelList();
        renderStatusCards();

        const conversations = getConversationsForActiveChannel();
        renderConversationCards(conversations);

        const activeConversation = getActiveConversation();
        renderThreadHeader(activeConversation);
        renderThreadMessages(activeConversation);
        renderComposer(activeConversation);
      }

      async function refreshAll() {
        if (state.refreshInFlight) {
          return;
        }

        state.refreshInFlight = true;
        syncDraftFromInputs();

        try {
          await loadData();
          renderAll();
        } finally {
          state.refreshInFlight = false;
        }
      }

      toggleChannelForm?.addEventListener("click", function () {
        channelFormPanel.hidden = !channelFormPanel.hidden;
        if (!channelFormPanel.hidden) {
          channelFeedback.textContent = "";
          channelFeedback.className = "feedback";
        }
      });

      channelForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(channelForm).entries());

        try {
          const savedChannel = await window.AgendaGamaDataStore.save("channels", {
            nome: String(data.nome || "").trim(),
            publico: String(data.publico || "").trim(),
            descricao: String(data.descricao || "").trim(),
            created_by_name: session.name,
            created_at: nowIso()
          }, DEFAULT_CHANNELS);

          channelForm.reset();
          state.activeChannelId = savedChannel.id;
          channelFeedback.textContent = "Canal criado com sucesso.";
          channelFeedback.className = "feedback success";
          await refreshAll();
        } catch (error) {
          channelFeedback.textContent = error?.message || "Nao foi possivel criar o canal agora.";
          channelFeedback.className = "feedback error";
        }
      });

      channelSearch?.addEventListener("input", function (event) {
        state.searchTerm = event.target.value || "";
        renderAll();
      });

      channelButtonList?.addEventListener("click", function (event) {
        const button = event.target.closest("[data-channel-id]");
        if (!button) return;

        state.activeChannelId = button.dataset.channelId;
        state.activeConversationId = null;
        renderAll();
      });

      filterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          state.activeFilter = button.dataset.filter || "todas";
          state.activeConversationId = null;
          renderAll();
        });
      });

      conversationList?.addEventListener("click", function (event) {
        const button = event.target.closest("[data-conversation-id]");
        if (!button) return;

        state.activeConversationId = button.dataset.conversationId;
        renderAll();
      });

      quickOpenChat?.addEventListener("click", function () {
        state.activeFilter = "responder";
        const channel = getActiveChannel();
        if (!channel) return;

        const conversations = getConversationSet(channel, state.messages, session, state.directory, state.responsibleMap);
        const preferredConversation = conversations.find(function (conversation) {
          return conversation.roomId === "escola" && conversation.canCompose;
        }) || conversations.find(function (conversation) {
          return conversation.canCompose;
        }) || conversations[0] || null;

        state.activeConversationId = preferredConversation?.id || null;
        renderAll();
        chatInput?.focus();
      });

      staffTargetMode?.addEventListener("change", function () {
        syncDraftFromInputs();
        renderComposer(getActiveConversation());
      });

      chatInput?.addEventListener("input", syncDraftFromInputs);
      staffTargetList?.addEventListener("change", syncDraftFromInputs);

      chatForm?.addEventListener("submit", async function (event) {
        event.preventDefault();

        const activeConversation = getActiveConversation();
        if (!activeConversation) return;

        const submitter = event.submitter;
        const action = submitter?.value || (submitter?.textContent?.toLowerCase().includes("rascunho") ? "draft" : "send");
        const content = String(chatInput.value || "").trim();

        if (!content) {
          chatFeedback.textContent = "Digite uma mensagem para continuar.";
          chatFeedback.className = "feedback error";
          return;
        }

        let recipientType = "escola";
        let recipients = ["escola"];

        if (activeConversation.roomId === "mural") {
          recipientType = "turmas";
          recipients = [getChannelTurma(activeConversation.channel)];
        } else if (session.role === "responsaveis") {
          recipientType = "escola";
          recipients = ["escola"];
        } else {
          const responsaveisDaTurma = activeConversation.responsaveis || [];
          if (staffTargetMode.value === "individual") {
            recipients = Array.from(staffTargetList.selectedOptions).map(function (option) {
              return option.value;
            });

            if (!recipients.length) {
              chatFeedback.textContent = "Selecione pelo menos um responsavel.";
              chatFeedback.className = "feedback error";
              return;
            }
          } else {
            recipients = responsaveisDaTurma.map(function (item) {
              return item.email || item.nome;
            });
          }

          if (!recipients.length) {
            chatFeedback.textContent = "Essa turma ainda nao possui responsaveis vinculados.";
            chatFeedback.className = "feedback error";
            return;
          }

          recipientType = "responsaveis";
        }

        const nextStatus = action === "draft"
          ? "rascunho"
          : session.role === "responsaveis"
            ? "enviada"
            : session.canApprove
              ? "enviada"
              : "pendente de aprovacao";

        try {
          await window.AgendaGamaDataStore.save("messages", {
            canal_id: activeConversation.channel.id,
            canal_nome: activeConversation.channel.nome,
            sender_name: session.name,
            sender_email: session.email,
            sender_role: session.role,
            recipient_type: recipientType,
            recipients: recipients,
            subject: `${getRoomLabel(activeConversation.roomId)} - ${activeConversation.channel.nome}`,
            content: content,
            status: nextStatus,
            approved_by: action === "send" && session.canApprove ? session.name : "",
            sent_by: action === "send" && (session.canApprove || session.role === "responsaveis") ? session.name : "",
            created_at: nowIso()
          }, DEFAULT_MESSAGES);

          state.draftState[activeConversation.id] = {
            content: "",
            targetMode: String(staffTargetMode?.value || "geral"),
            targetRecipients: []
          };
          chatForm.reset();
          if (staffTargetMode) {
            staffTargetMode.value = "geral";
          }
          chatFeedback.textContent = action === "draft"
            ? "Mensagem salva como rascunho."
            : nextStatus === "enviada"
              ? "Mensagem enviada com sucesso."
              : "Mensagem enviada para aprovacao.";
          chatFeedback.className = "feedback success";
          await refreshAll();
        } catch (error) {
          chatFeedback.textContent = error?.message || "Nao foi possivel salvar a mensagem agora.";
          chatFeedback.className = "feedback error";
        }
      });

      threadBody?.addEventListener("click", async function (event) {
        const button = event.target.closest(".approval-action");
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;
        const message = state.messages.find(function (item) {
          return item.id === id;
        });
        if (!message) return;

        const nextMessage = { ...message };
        if (action === "approve") {
          nextMessage.status = "aprovada";
          nextMessage.approved_by = session.name;
        }

        if (action === "send") {
          nextMessage.status = "enviada";
          nextMessage.approved_by = nextMessage.approved_by || session.name;
          nextMessage.sent_by = session.name;
        }

        try {
          await window.AgendaGamaDataStore.save("messages", nextMessage, DEFAULT_MESSAGES);
          await refreshAll();
        } catch (error) {
          chatFeedback.textContent = error?.message || "Nao foi possivel atualizar a mensagem.";
          chatFeedback.className = "feedback error";
        }
      });

      if (!storageListenerAttached) {
        window.addEventListener("storage", function (event) {
          if (!event.key || !event.key.startsWith("agenda-gama-")) {
            return;
          }

          refreshAll();
        });
        storageListenerAttached = true;
      }

      if (refreshTimer) {
        clearInterval(refreshTimer);
      }

      refreshTimer = window.setInterval(function () {
        refreshAll();
      }, 3000);

      await refreshAll();
    });
  }

  window.AgendaGamaCommunication = { mountCommunication: mountCommunication };
})();
