(function () {
  const MESSAGE_PREFIX = "AGAMA_MESSAGE::";
  const THREAD_STATE_KEY = "agenda-gama-message-thread-state";
  const THREAD_VIEW_KEY = "agenda-gama-message-thread-view";
  const CHANNEL_FILTER_KEY = "agenda-gama-message-left-filter";
  const MESSAGE_PANEL_MODE_KEY = "agenda-gama-message-panel-mode";

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
        aluno_id: "aluno-demo-1",
        nome: "Mariana Alves",
        parentesco: "Mae",
        aluno: "Ana Clara Silva",
        contato: "(11) 99999-2201",
        email: "responsavel@gama.edu.br",
        access_status: "Acesso ativo"
      },
      {
        id: "resp-demo-2",
        aluno_id: "aluno-demo-2",
        nome: "Renato Henrique",
        parentesco: "Pai",
        aluno: "Pedro Henrique",
        contato: "(11) 99999-2202",
        email: "renato.henrique@gama.edu.br",
        access_status: "Convite enviado"
      }
    ],
    professores: [
      { id: "prof-demo-1", nome: "Helena Souza", disciplinas: "Matematica, Historia", turno: "Manha", email: "professor@gama.edu.br" },
      { id: "prof-demo-2", nome: "Ricardo Lima", disciplinas: "Portugues", turno: "Tarde", email: "ricardo@agendagama.com" }
    ],
    equipe: [
      { id: "equipe-demo-1", nome: "Lucia Mendes", cargo: "Diretora", setor: "Coordenacao", contato: "(11) 99999-1001", email: "direcao@gama.edu.br" },
      { id: "equipe-demo-2", nome: "Carlos Secretaria", cargo: "Secretario", setor: "Secretaria", contato: "(11) 99999-1002", email: "funcionario@gama.edu.br" }
    ]
  };

  const STORED_CHANNELS_SEED = [
    {
      id: "canal-turma-1",
      nome: "Canal 1o Ano A",
      publico: "1o Ano A",
      descricao: "Canal geral da turma para recados, comunicados e atendimento da familia.",
      created_by_name: "Amanda Gama",
      created_at: "2026-04-16T07:40:00.000Z"
    },
    {
      id: "canal-turma-2",
      nome: "Canal 5o Ano B",
      publico: "5o Ano B",
      descricao: "Canal geral da turma para rotina, secretaria e alinhamento com a familia.",
      created_by_name: "Amanda Gama",
      created_at: "2026-04-16T08:00:00.000Z"
    }
  ];

  const VIRTUAL_CHANNELS = [
    { id: "setor-secretaria", nome: "Secretaria", channelType: "secretaria", publico: "Atendimento geral", descricao: "Atendimento administrativo e vida escolar." },
    { id: "setor-coordenacao", nome: "Coordenacao", channelType: "coordenacao", publico: "Pedagogico", descricao: "Orientacao pedagogica e acompanhamento escolar." },
    { id: "setor-financeiro", nome: "Financeiro", channelType: "financeiro", publico: "Atendimento", descricao: "Mensalidades, boletos e combinados financeiros." },
    { id: "setor-professor", nome: "Professor", channelType: "professor", publico: "Sala de aula", descricao: "Contato com professor ou equipe docente." }
  ];

  const QUICK_TEMPLATES = [
    { id: "tpl-recebido", label: "Recebido", text: "Recebemos sua mensagem e vamos retornar em breve com as orientacoes." },
    { id: "tpl-documento", label: "Documento", text: "Por favor, envie o documento solicitado para darmos continuidade ao atendimento." },
    { id: "tpl-reuniao", label: "Reuniao", text: "Podemos seguir com esse atendimento em reuniao. Informe sua disponibilidade de horario." },
    { id: "tpl-encerrado", label: "Encerrar", text: "Atendimento concluido. Se precisar de algo mais, estamos a disposicao." }
  ];

  const DEFAULT_MESSAGES = [
    buildSeedMessage({
      id: "msg-demo-1",
      canal_id: "canal-turma-1",
      canal_nome: "Canal 1o Ano A",
      sender_name: "Carlos Secretaria",
      sender_email: "funcionario@gama.edu.br",
      sender_role: "funcionarios",
      recipient_type: "responsaveis",
      recipients: ["responsavel@gama.edu.br"],
      status: "sent",
      created_at: "2026-04-16T09:15:00.000Z",
      thread: {
        key: "family:canal-turma-1:resp-demo-1:secretaria",
        type: "family",
        channelId: "canal-turma-1",
        channelName: "Canal 1o Ano A",
        channelType: "turma",
        sector: "Secretaria",
        responsibleId: "resp-demo-1",
        responsibleName: "Mariana Alves",
        responsibleEmail: "responsavel@gama.edu.br",
        studentId: "aluno-demo-1",
        studentName: "Ana Clara Silva",
        turma: "1o Ano A",
        subject: "Agenda e uniforme"
      },
      text: "Bom dia. O uniforme pode ser regularizado ate sexta-feira sem prejuizo para a aluna."
    }),
    buildSeedMessage({
      id: "msg-demo-2",
      canal_id: "canal-turma-1",
      canal_nome: "Canal 1o Ano A",
      sender_name: "Mariana Alves",
      sender_email: "responsavel@gama.edu.br",
      sender_role: "responsaveis",
      recipient_type: "escola",
      recipients: ["Secretaria"],
      status: "sent",
      created_at: "2026-04-16T08:55:00.000Z",
      thread: {
        key: "family:canal-turma-1:resp-demo-1:secretaria",
        type: "family",
        channelId: "canal-turma-1",
        channelName: "Canal 1o Ano A",
        channelType: "turma",
        sector: "Secretaria",
        responsibleId: "resp-demo-1",
        responsibleName: "Mariana Alves",
        responsibleEmail: "responsavel@gama.edu.br",
        studentId: "aluno-demo-1",
        studentName: "Ana Clara Silva",
        turma: "1o Ano A",
        subject: "Agenda e uniforme"
      },
      text: "Bom dia. Gostaria de confirmar se a agenda digital substitui os bilhetes e se o uniforme completo passa a ser obrigatorio ja nesta semana."
    }),
    buildSeedMessage({
      id: "msg-demo-3",
      canal_id: "canal-turma-1",
      canal_nome: "Canal 1o Ano A",
      sender_name: "Carlos Secretaria",
      sender_email: "funcionario@gama.edu.br",
      sender_role: "funcionarios",
      recipient_type: "turmas",
      recipients: ["1o Ano A"],
      status: "sent",
      created_at: "2026-04-16T07:20:00.000Z",
      thread: {
        key: "broadcast:canal-turma-1",
        type: "broadcast",
        channelId: "canal-turma-1",
        channelName: "Canal 1o Ano A",
        channelType: "turma",
        sector: "Secretaria",
        turma: "1o Ano A",
        subject: "Comunicados gerais"
      },
      text: "Lembramos que a reuniao de pais do 1o Ano A sera hoje, as 18h30, no auditorio."
    }),
    buildSeedMessage({
      id: "msg-demo-4",
      canal_id: "canal-turma-2",
      canal_nome: "Canal 5o Ano B",
      sender_name: "Ricardo Lima",
      sender_email: "ricardo@agendagama.com",
      sender_role: "professores",
      recipient_type: "responsaveis",
      recipients: ["renato.henrique@gama.edu.br"],
      status: "pending_approval",
      created_at: "2026-04-16T10:10:00.000Z",
      thread: {
        key: "family:canal-turma-2:resp-demo-2:professor",
        type: "family",
        channelId: "canal-turma-2",
        channelName: "Canal 5o Ano B",
        channelType: "turma",
        sector: "Professor",
        responsibleId: "resp-demo-2",
        responsibleName: "Renato Henrique",
        responsibleEmail: "renato.henrique@gama.edu.br",
        studentId: "aluno-demo-2",
        studentName: "Pedro Henrique",
        turma: "5o Ano B",
        subject: "Atividade de Portugues"
      },
      text: "Gostaria de alinhar a entrega da atividade de Portugues e verificar se o aluno precisa de novo prazo."
    }),
    buildSeedMessage({
      id: "msg-demo-5",
      canal_id: "canal-turma-1",
      canal_nome: "Canal 1o Ano A",
      sender_name: "Lucia Mendes",
      sender_email: "direcao@gama.edu.br",
      sender_role: "funcionarios",
      recipient_type: "interno",
      recipients: ["Equipe interna"],
      status: "sent",
      created_at: "2026-04-16T09:40:00.000Z",
      thread: {
        key: "family:canal-turma-1:resp-demo-1:secretaria",
        type: "family",
        channelId: "canal-turma-1",
        channelName: "Canal 1o Ano A",
        channelType: "turma",
        sector: "Secretaria",
        responsibleId: "resp-demo-1",
        responsibleName: "Mariana Alves",
        responsibleEmail: "responsavel@gama.edu.br",
        studentId: "aluno-demo-1",
        studentName: "Ana Clara Silva",
        turma: "1o Ano A",
        subject: "Agenda e uniforme"
      },
      text: "Observacao interna: familia costuma responder rapido por e-mail. Priorizar retorno ainda hoje.",
      internalOnly: true
    })
  ];

  function buildSeedMessage(input) {
    return {
      id: input.id,
      canal_id: input.canal_id,
      canal_nome: input.canal_nome,
      sender_name: input.sender_name,
      sender_email: input.sender_email,
      sender_role: input.sender_role,
      recipient_type: input.recipient_type,
      recipients: input.recipients,
      subject: input.thread.subject || input.canal_nome,
      content: encodeEnvelope({
        text: input.text,
        internalOnly: Boolean(input.internalOnly),
        attachments: input.attachments || [],
        thread: input.thread
      }),
      status: input.status,
      approved_by: input.approved_by || "",
      sent_by: input.sent_by || input.sender_name,
      created_at: input.created_at
    };
  }

  function encodeEnvelope(payload) {
    return `${MESSAGE_PREFIX}${JSON.stringify(payload)}`;
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

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeEmail(value) {
    return normalizeText(value);
  }

  function slugify(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getInitials(name) {
    return String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0); })
      .join("")
      .toUpperCase() || "AG";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatShortTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function formatFullDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long"
    });
  }

  function formatBytes(value) {
    const size = Number(value || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
    return `${Math.round(size / 104857.6) / 10} MB`;
  }

  function sortByRecent(items, accessor) {
    return [...(items || [])].sort(function (left, right) {
      const leftValue = new Date(accessor(left) || 0).getTime();
      const rightValue = new Date(accessor(right) || 0).getTime();
      return rightValue - leftValue;
    });
  }

  function sortByOldest(items, accessor) {
    return [...(items || [])].sort(function (left, right) {
      const leftValue = new Date(accessor(left) || 0).getTime();
      const rightValue = new Date(accessor(right) || 0).getTime();
      return leftValue - rightValue;
    });
  }

  function ensureShellContent(callback) {
    if (document.getElementById("message-board-list")) {
      callback();
      return;
    }

    window.addEventListener("agenda-shell-ready", function handleReady() {
      window.removeEventListener("agenda-shell-ready", handleReady);
      callback();
    });
  }

  function ensureStatus(status) {
    const legacy = {
      "rascunho": "draft",
      "pendente de aprovacao": "pending_approval",
      "aprovada": "approved",
      "enviada": "sent",
      "aguardando aprovacao": "pending_approval",
      "devolvida": "returned",
      "rejeitada": "rejected",
      "encerrada": "closed"
    };

    return legacy[String(status || "").trim().toLowerCase()] || status || "sent";
  }

  function getWorkflowLabel(status) {
    const labels = {
      draft: "Rascunho",
      pending_approval: "Aguardando aprovacao",
      returned: "Devolvida",
      rejected: "Rejeitada",
      approved: "Aprovada",
      sent: "Enviada",
      closed: "Encerrada"
    };

    return labels[ensureStatus(status)] || "Em andamento";
  }

  function getWorkflowClass(status) {
    const current = ensureStatus(status);
    if (current === "pending_approval") return "status-pendente";
    if (current === "approved") return "status-aprovada";
    if (current === "sent" || current === "closed") return "status-enviada";
    return "status-rascunho";
  }

  function parseEnvelope(message) {
    const raw = String(message?.content || "");
    if (!raw.startsWith(MESSAGE_PREFIX)) {
      return {
        text: raw,
        internalOnly: false,
        attachments: [],
        thread: null,
        placeholder: false
      };
    }

    try {
      return JSON.parse(raw.slice(MESSAGE_PREFIX.length));
    } catch (error) {
      return {
        text: raw,
        internalOnly: false,
        attachments: [],
        thread: null,
        placeholder: false
      };
    }
  }

  function buildMaps(directory) {
    const studentsById = new Map((directory.alunos || []).map(function (item) { return [item.id, item]; }));
    const responsaveisById = new Map((directory.responsaveis || []).map(function (item) { return [item.id, item]; }));
    const responsaveisByEmail = new Map((directory.responsaveis || []).map(function (item) { return [normalizeEmail(item.email), item]; }));
    const responsaveisByName = new Map((directory.responsaveis || []).map(function (item) { return [normalizeText(item.nome), item]; }));

    return {
      studentsById: studentsById,
      responsaveisById: responsaveisById,
      responsaveisByEmail: responsaveisByEmail,
      responsaveisByName: responsaveisByName
    };
  }

  function findStudentByName(directory, name) {
    return (directory.alunos || []).find(function (item) {
      return normalizeText(item.nome) === normalizeText(name);
    }) || null;
  }

  function inferSectorFromMessage(message, senderRecord) {
    if (message.sender_role === "professores") return "Professor";
    if (message.recipient_type === "interno") return "Coordenacao";
    if (senderRecord?.setor) return senderRecord.setor;
    return "Secretaria";
  }

  function inferLegacyThread(message, directory, channels, maps) {
    const channel = channels.find(function (item) {
      return item.id === message.canal_id || normalizeText(item.nome) === normalizeText(message.canal_nome);
    }) || null;
    const senderRecord = maps.responsaveisByEmail.get(normalizeEmail(message.sender_email))
      || maps.responsaveisByName.get(normalizeText(message.sender_name))
      || null;
    const targetRecord = (Array.isArray(message.recipients) ? message.recipients : []).map(function (token) {
      return maps.responsaveisByEmail.get(normalizeEmail(token)) || maps.responsaveisByName.get(normalizeText(token)) || null;
    }).find(Boolean) || senderRecord;

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
    const envelope = parseEnvelope(message);
    return {
      ...message,
      workflowStatus: ensureStatus(message.status),
      parsed: {
        text: envelope.text || "",
        internalOnly: Boolean(envelope.internalOnly),
        attachments: Array.isArray(envelope.attachments) ? envelope.attachments : [],
        thread: envelope.thread || inferLegacyThread(message, directory, channels, maps),
        placeholder: Boolean(envelope.placeholder)
      }
    };
  }

  function getActorContext(session, directory) {
    const professor = (directory.professores || []).find(function (item) {
      return normalizeEmail(item.email) === normalizeEmail(session.email) || normalizeText(item.nome) === normalizeText(session.name);
    }) || null;
    const funcionario = (directory.equipe || []).find(function (item) {
      return normalizeEmail(item.email) === normalizeEmail(session.email) || normalizeText(item.nome) === normalizeText(session.name);
    }) || null;
    const responsavelRecords = (directory.responsaveis || []).filter(function (item) {
      return normalizeEmail(item.email) === normalizeEmail(session.email);
    });
    const responsavelTurmas = new Set();

    const professorTurmas = new Set();
    if (professor?.turmas) {
      String(professor.turmas).split(",").map(function (item) { return item.trim(); }).filter(Boolean).forEach(function (item) {
        professorTurmas.add(item);
      });
    } else if (professor?.turno) {
      (directory.turmas || []).filter(function (turma) {
        return normalizeText(turma.turno) === normalizeText(professor.turno);
      }).forEach(function (turma) {
        professorTurmas.add(turma.nome);
      });
    }

    const funcionarioSectors = new Set();
    if (funcionario?.setor) funcionarioSectors.add(funcionario.setor);
    if (funcionario?.cargo) funcionarioSectors.add(funcionario.cargo);
    if (session.role === "funcionarios" && !funcionarioSectors.size) {
      funcionarioSectors.add("Secretaria");
    }

    responsavelRecords.forEach(function (item) {
      const student = item.aluno_id
        ? (directory.alunos || []).find(function (candidate) { return candidate.id === item.aluno_id; })
        : findStudentByName(directory, item.aluno);
      if (student?.turma) {
        responsavelTurmas.add(student.turma);
      }
    });

    return {
      professor: professor,
      funcionario: funcionario,
      responsavelRecords: responsavelRecords,
      responsavelTurmas: responsavelTurmas,
      professorTurmas: professorTurmas,
      funcionarioSectors: funcionarioSectors
    };
  }

  function deriveChannelType(channel, directory) {
    if (channel?.channelType) return channel.channelType;
    if (VIRTUAL_CHANNELS.some(function (item) { return item.id === channel?.id; })) {
      return VIRTUAL_CHANNELS.find(function (item) { return item.id === channel?.id; })?.channelType || "custom";
    }

    const isTurmaChannel = (directory?.turmas || []).some(function (turma) {
      return normalizeText(turma.nome) === normalizeText(channel?.publico);
    });

    return isTurmaChannel ? "turma" : "custom";
  }

  function withDerivedChannelType(channel, directory) {
    return {
      ...channel,
      channelType: deriveChannelType(channel, directory)
    };
  }

  function getAllChannels(storedChannels, directory) {
    const merged = [...(storedChannels || [])].map(function (channel) {
      return withDerivedChannelType(channel, directory);
    });
    VIRTUAL_CHANNELS.forEach(function (channel) {
      if (!merged.some(function (item) { return item.id === channel.id; })) {
        merged.push(withDerivedChannelType(channel, directory));
      }
    });
    return merged;
  }

  function canSeeChannel(session, actorContext, channel) {
    if (session.role === "administrador" || session.canApprove) return true;
    if (session.role === "professores") {
      if (channel.channelType && channel.channelType !== "turma") return normalizeText(channel.nome) === "professor";
      return actorContext.professorTurmas.has(channel.publico);
    }
    if (session.role === "funcionarios") {
      if (channel.channelType && channel.channelType !== "turma") {
        return [...actorContext.funcionarioSectors].some(function (sector) {
          return normalizeText(sector).includes(normalizeText(channel.nome)) || normalizeText(channel.nome).includes(normalizeText(sector));
        }) || normalizeText(channel.nome) === "secretaria";
      }
      return true;
    }
    if (session.role === "responsaveis") {
      if (channel.channelType && channel.channelType !== "turma") return true;
      return actorContext.responsavelTurmas.has(channel.publico);
    }
    return false;
  }

  function getVisibleChannelsForSession(session, actorContext, channels) {
    return channels.filter(function (channel) {
      return canSeeChannel(session, actorContext, channel);
    });
  }

  function getSessionViewKey(session) {
    return `${session.role}:${normalizeEmail(session.email)}`;
  }

  function getSeenAt(viewState, session, threadKey) {
    return viewState[getSessionViewKey(session)]?.[threadKey] || "";
  }

  function markThreadRead(viewState, session, threadKey, timestamp) {
    const sessionKey = getSessionViewKey(session);
    const nextState = { ...viewState };
    nextState[sessionKey] = {
      ...(nextState[sessionKey] || {}),
      [threadKey]: timestamp
    };
    writeJson(THREAD_VIEW_KEY, nextState);
    return nextState;
  }

  function deriveCardStatus(thread, session) {
    if (thread.local.archived) return "Arquivada";
    if (thread.pendingApprovalCount > 0) return "Aguardando aprovacao";
    if (thread.local.resolved) return "Encerrada";
    if (thread.lastMessage?.parsed?.placeholder) return session.role === "responsaveis" ? "Aguardando retorno" : "Aguardando resposta";
    if (thread.unreadCount > 0) {
      if (session.role === "responsaveis") return "Aguardando retorno";
      return "Aguardando resposta";
    }
    if (thread.lastMessage?.workflowStatus === "approved") return "Aprovada";
    if (thread.lastMessage?.workflowStatus === "sent") return "Respondida";
    return "Enviada";
  }

  function buildThreadCollection(messages, session, actorContext, directory, channels, maps, threadState, viewState) {
    const grouped = new Map();

    messages.forEach(function (message) {
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

    return sortByRecent(Array.from(grouped.values()).map(function (thread) {
      const sortedMessages = sortByOldest(thread.messages, function (item) { return item.created_at; });
      const visibleMessages = sortedMessages.filter(function (message) {
        if (message.parsed.placeholder) return false;
        if (message.parsed.internalOnly) return false;
        if (session.role === "responsaveis" && message.workflowStatus !== "sent" && normalizeEmail(message.sender_email) !== normalizeEmail(session.email)) return false;
        return true;
      });
      const internalNotes = sortedMessages.filter(function (message) { return message.parsed.internalOnly; });
      const lastVisible = visibleMessages[visibleMessages.length - 1] || null;
      const unreadCount = visibleMessages.filter(function (message) {
        return normalizeEmail(message.sender_email) !== normalizeEmail(session.email)
          && new Date(message.created_at || 0).getTime() > new Date(getSeenAt(viewState, session, thread.key) || 0).getTime();
      }).length;
      const pendingApprovalCount = sortedMessages.filter(function (message) {
        return message.workflowStatus === "pending_approval";
      }).length;

      return {
        ...thread,
        messages: sortedMessages,
        visibleMessages: visibleMessages,
        internalNotes: internalNotes,
        lastMessage: lastVisible || sortedMessages[sortedMessages.length - 1] || null,
        unreadCount: unreadCount,
        pendingApprovalCount: pendingApprovalCount,
        cardStatus: deriveCardStatus({ ...thread, unreadCount, pendingApprovalCount, lastMessage: lastVisible || sortedMessages[sortedMessages.length - 1] || null }, session)
      };
    }), function (thread) {
      return thread.lastMessage?.created_at || "";
    }).filter(function (thread) {
      return canViewThread(thread, session, actorContext);
    });
  }

  function canViewThread(thread, session, actorContext) {
    if (session.role === "administrador" || session.canApprove) return true;
    if (session.role === "responsaveis") {
      if (thread.type === "broadcast") {
        return actorContext.responsavelTurmas.has(thread.turma);
      }

      return normalizeEmail(thread.responsibleEmail) === normalizeEmail(session.email);
    }

    if (session.role === "professores") {
      return actorContext.professorTurmas.has(thread.turma)
        || thread.messages.some(function (message) {
          return normalizeEmail(message.sender_email) === normalizeEmail(session.email);
        })
        || normalizeEmail(thread.local.assignedEmail) === normalizeEmail(session.email);
    }

    if (session.role === "funcionarios") {
      if (!actorContext.funcionarioSectors.size) return true;
      if (thread.type === "broadcast") return true;
      return [...actorContext.funcionarioSectors].some(function (sector) {
        return normalizeText(thread.sector).includes(normalizeText(sector)) || normalizeText(sector).includes(normalizeText(thread.sector));
      });
    }

    return false;
  }

  function matchesSearch(thread, searchTerm) {
    if (!searchTerm) return true;
    const haystack = [
      thread.responsibleName,
      thread.studentName,
      thread.turma,
      thread.subject,
      thread.channelName,
      thread.sector,
      thread.lastMessage?.parsed?.text
    ].join(" ");

    return normalizeText(haystack).includes(searchTerm);
  }

  function matchesBoardTab(thread, activeTab) {
    if (activeTab === "aprovar") return thread.pendingApprovalCount > 0;
    if (activeTab === "arquivadas") return Boolean(thread.local.archived);
    if (activeTab === "nao-lidas") return thread.unreadCount > 0 && !thread.local.archived;
    if (activeTab === "responder") return !thread.local.archived && !thread.local.resolved;
    return !thread.local.archived;
  }

  function matchesAdvancedFilters(thread, filters) {
    if (filters.channelId && thread.channelId !== filters.channelId && thread.channelName !== filters.channelId) return false;
    if (filters.turma && normalizeText(thread.turma) !== normalizeText(filters.turma)) return false;
    if (filters.sector && normalizeText(thread.sector) !== normalizeText(filters.sector)) return false;
    if (filters.status && normalizeText(thread.cardStatus) !== normalizeText(filters.status)) return false;
    if (filters.unread === "nao-lidas" && thread.unreadCount === 0) return false;
    if (filters.unread === "lidas" && thread.unreadCount > 0) return false;
    return true;
  }

  function filterSidebarThreads(threads, leftFilter, searchTerm, channelId) {
    return threads.filter(function (thread) {
      if (channelId && thread.channelId !== channelId && thread.channelName !== channelId) return false;
      if (!matchesSearch(thread, searchTerm)) return false;
      if (leftFilter === "unread") return thread.unreadCount > 0;
      if (leftFilter === "urgent") return Boolean(thread.local.urgent);
      if (leftFilter === "pinned") return Boolean(thread.local.pinned);
      return true;
    });
  }

  function filterBoardThreads(threads, state) {
    return threads
      .filter(function (thread) { return matchesBoardTab(thread, state.activeTab); })
      .filter(function (thread) { return matchesSearch(thread, state.searchTerm); })
      .filter(function (thread) { return matchesAdvancedFilters(thread, state.filters); });
  }

  function sortThreads(threads) {
    return [...threads].sort(function (left, right) {
      const leftPinned = left.local.pinned ? 1 : 0;
      const rightPinned = right.local.pinned ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;

      const leftUrgent = left.local.urgent ? 1 : 0;
      const rightUrgent = right.local.urgent ? 1 : 0;
      if (leftUrgent !== rightUrgent) return rightUrgent - leftUrgent;

      return new Date(right.lastMessage?.created_at || 0).getTime() - new Date(left.lastMessage?.created_at || 0).getTime();
    });
  }

  function getThreadTitle(thread) {
    if (!thread) return "";
    return thread.type === "broadcast" ? thread.channelName : (thread.responsibleName || thread.channelName);
  }

  function getThreadSubtitle(thread) {
    if (!thread) return "";
    if (thread.type === "broadcast") {
      return [thread.turma || thread.channelName, thread.sector || "Canal escolar"].filter(Boolean).join(" | ");
    }

    return [thread.studentName || "Aluno sem vinculo", thread.turma || "", thread.sector || ""].filter(Boolean).join(" | ");
  }

  function isReadOnlyThread(thread, session) {
    return Boolean(thread && session.role === "responsaveis" && thread.type === "broadcast");
  }

  function isAssignedToCurrentUser(thread, session) {
    return Boolean(thread && normalizeEmail(thread.local.assignedEmail) === normalizeEmail(session.email));
  }

  function canDeleteMessage(message, thread, session) {
    if (!message || !thread) return false;

    const mine = normalizeEmail(message.sender_email) === normalizeEmail(session.email);

    if (session.role === "administrador" || session.canApprove) return true;
    if (session.role === "responsaveis") return mine;
    if (session.role === "professores" || session.role === "funcionarios") {
      return mine || isAssignedToCurrentUser(thread, session);
    }

    return false;
  }

  function canReplyToThread(thread, session) {
    if (!thread) return false;
    if (isReadOnlyThread(thread, session)) return false;
    if (session.role === "responsaveis") return true;
    if (session.role === "administrador" || session.canApprove) return true;
    return isAssignedToCurrentUser(thread, session);
  }

  function getComposerContext(thread, session, internalMode) {
    if (!thread) return "";
    if (internalMode && session.role !== "responsaveis") {
      return "Modo de observacao interna ativado. Essa nota nao aparece para a familia.";
    }
    if (isReadOnlyThread(thread, session)) {
      return "Canal somente leitura para a familia. Use uma conversa individual para falar com a escola.";
    }
    if (session.role !== "responsaveis" && !session.canApprove && !isAssignedToCurrentUser(thread, session)) {
      return "Assuma essa conversa para responder em tempo real e registrar o atendimento.";
    }
    if (thread.type === "broadcast") {
      return `Canal da turma ${thread.turma || thread.channelName}. Sem selecao individual, a mensagem segue para todos os responsaveis vinculados a essa turma.`;
    }
    return `${thread.responsibleName} | ${thread.studentName || "Aluno"} | ${thread.turma || thread.sector || "Atendimento"}`;
  }

  function getResponsibleLinkedStudents(state) {
    const seen = new Set();
    return state.actorContext.responsavelRecords.map(function (item) {
      const student = item.aluno_id
        ? (state.directory.alunos || []).find(function (candidate) { return candidate.id === item.aluno_id; })
        : findStudentByName(state.directory, item.aluno);
      if (!student || seen.has(student.id)) return null;
      seen.add(student.id);
      return student;
    }).filter(Boolean);
  }

  function getResponsaveisForTurma(directory, turma) {
    const normalizedTurma = normalizeText(turma);
    if (!normalizedTurma) return [];

    const alunosDaTurma = (directory.alunos || []).filter(function (student) {
      return normalizeText(student.turma) === normalizedTurma;
    });
    const alunosPorId = new Set(alunosDaTurma.map(function (student) { return student.id; }));
    const alunosPorNome = new Set(alunosDaTurma.map(function (student) { return normalizeText(student.nome); }));

    return (directory.responsaveis || []).filter(function (item) {
      if (item.aluno_id && alunosPorId.has(item.aluno_id)) return true;
      return alunosPorNome.has(normalizeText(item.aluno));
    });
  }

  function getBroadcastRecipients(directory, turma, fallbackLabel) {
    const emails = getResponsaveisForTurma(directory, turma)
      .map(function (item) { return normalizeEmail(item.email); })
      .filter(Boolean);
    const uniqueEmails = [...new Set(emails)];

    return uniqueEmails;
  }

  function pickThreadChannelForStudent(student, channels) {
    if (!student) {
      return channels.find(function (item) { return item.id === "setor-secretaria"; }) || channels[0] || null;
    }

    return channels.find(function (item) {
      return item.channelType === "turma" && normalizeText(item.publico) === normalizeText(student.turma);
    }) || channels.find(function (item) {
      return item.id === "setor-secretaria";
    }) || channels[0] || null;
  }

  function getThreadPreview(thread) {
    if (!thread?.lastMessage) return "Conversa iniciada. Abra o chat para enviar a primeira mensagem.";
    if (thread.lastMessage.parsed?.placeholder) return "Conversa iniciada. Abra o chat para enviar a primeira mensagem.";
    return thread.lastMessage.parsed?.text || "Sem mensagens registradas.";
  }

  function getAvailableChannelsForNewThread(threadType, channels) {
    if (threadType === "broadcast") {
      return (channels || []).filter(function (channel) {
        return channel.channelType === "turma";
      });
    }

    return channels || [];
  }

  function setSelectValueIfPresent(select, value) {
    if (!select) return;
    const normalizedValue = String(value || "");
    const values = Array.from(select.options || []).map(function (option) { return option.value; });
    if (!values.length) {
      select.value = "";
      return;
    }
    select.value = values.includes(normalizedValue) ? normalizedValue : values[0];
  }

  function normalizeViewMode(value) {
    return value === "thread" ? "thread" : "board";
  }

  function buildStatusBadge(label) {
    const normalized = normalizeText(label);
    let className = "status-enviada";
    if (normalized.includes("aguardando aprovacao") || normalized.includes("devolvida")) className = "status-pendente";
    if (normalized.includes("aprovada")) className = "status-aprovada";
    if (normalized.includes("aguardando resposta") || normalized.includes("retorno")) className = "status-aprovada";
    if (normalized.includes("encerr") || normalized.includes("arquivad") || normalized.includes("rejeitada") || normalized.includes("rascunho")) className = "status-rascunho";
    return `<span class="status-badge ${className}">${escapeHtml(label)}</span>`;
  }

  function renderAvatar(name) {
    return `<span class="message-avatar">${escapeHtml(getInitials(name))}</span>`;
  }

  function groupMessagesByDate(messages) {
    const groups = [];
    sortByOldest(messages, function (item) { return item.created_at; }).forEach(function (message) {
      const dateLabel = formatFullDate(message.created_at);
      const group = groups[groups.length - 1];
      if (!group || group.label !== dateLabel) {
        groups.push({ label: dateLabel, items: [message] });
        return;
      }
      group.items.push(message);
    });
    return groups;
  }

  function readThreadState() {
    return readJson(THREAD_STATE_KEY, {
      "family:canal-turma-1:resp-demo-1:secretaria": {
        urgent: true,
        pinned: true,
        assignedTo: "Carlos Secretaria",
        assignedEmail: "funcionario@gama.edu.br"
      }
    });
  }

  function updateThreadState(state, threadKey, patch) {
    state.threadState = {
      ...state.threadState,
      [threadKey]: {
        ...(state.threadState[threadKey] || {}),
        ...patch
      }
    };
    writeJson(THREAD_STATE_KEY, state.threadState);
  }

  function removeThreadState(threadKey) {
    const currentState = readJson(THREAD_STATE_KEY, {});
    if (!currentState[threadKey]) return;
    delete currentState[threadKey];
    writeJson(THREAD_STATE_KEY, currentState);
  }

  function removeThreadViewState(threadKey) {
    const currentState = readJson(THREAD_VIEW_KEY, {});
    Object.keys(currentState).forEach(function (sessionKey) {
      if (!currentState[sessionKey] || !currentState[sessionKey][threadKey]) return;
      delete currentState[sessionKey][threadKey];
      if (!Object.keys(currentState[sessionKey]).length) {
        delete currentState[sessionKey];
      }
    });
    writeJson(THREAD_VIEW_KEY, currentState);
  }

  function buildAttachmentList(files) {
    return Promise.all((files || []).map(function (file) {
      return new Promise(function (resolve, reject) {
        if (file.size > 1024 * 1024 * 2) {
          reject(new Error(`O arquivo ${file.name} excede o limite de 2 MB.`));
          return;
        }

        const reader = new FileReader();
        reader.onload = function () {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result
          });
        };
        reader.onerror = function () {
          reject(new Error(`Nao foi possivel ler o arquivo ${file.name}.`));
        };
        reader.readAsDataURL(file);
      });
    }));
  }

  function buildSystemNote(thread, text, senderName, senderEmail, senderRole) {
    return {
      canal_id: thread.channelId || null,
      canal_nome: thread.channelName,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_role: senderRole,
      recipient_type: "interno",
      recipients: ["Equipe interna"],
      subject: thread.subject || thread.channelName,
      content: encodeEnvelope({
        text: text,
        internalOnly: true,
        attachments: [],
        thread: {
          key: thread.key,
          type: thread.type,
          channelId: thread.channelId || null,
          channelName: thread.channelName,
          channelType: thread.channelType || "turma",
          sector: thread.sector,
          responsibleId: thread.responsibleId || null,
          responsibleName: thread.responsibleName || "",
          responsibleEmail: thread.responsibleEmail || "",
          studentId: thread.studentId || null,
          studentName: thread.studentName || "",
          turma: thread.turma || "",
          subject: thread.subject || thread.channelName
        }
      }),
      status: "sent",
      approved_by: "",
      sent_by: senderName,
      created_at: nowIso()
    };
  }

  async function mountCommunication() {
    ensureShellContent(async function () {
      const session = window.AgendaGamaAuth.getSession();
      if (!session) return;
      const initialUrl = new URL(window.location.href);
      const initialThreadParam = initialUrl.searchParams.get("thread");

      const refs = {
        layout: document.getElementById("message-central-layout"),
        searchInput: document.getElementById("message-search-input"),
        toggleNewThread: document.getElementById("toggle-new-thread"),
        openChannelManager: document.getElementById("open-channel-manager"),
        newThreadModal: document.getElementById("new-thread-modal"),
        newThreadPanel: document.getElementById("new-thread-panel"),
        newThreadForm: document.getElementById("new-thread-form"),
        cancelNewThread: document.getElementById("cancel-new-thread"),
        closeNewThread: document.getElementById("close-new-thread"),
        newThreadFeedback: document.getElementById("new-thread-feedback"),
        newThreadType: document.getElementById("new-thread-type"),
        newThreadChannelField: document.getElementById("new-thread-channel-field"),
        newThreadChannel: document.getElementById("new-thread-channel"),
        newThreadStudentField: document.getElementById("new-thread-student-field"),
        newThreadStudent: document.getElementById("new-thread-student"),
        newThreadResponsavelField: document.getElementById("new-thread-responsavel-field"),
        newThreadResponsavel: document.getElementById("new-thread-responsavel"),
        newThreadSector: document.getElementById("new-thread-sector"),
        newThreadSubject: document.getElementById("new-thread-subject"),
        channelManagerModal: document.getElementById("channel-manager-modal"),
        closeChannelManager: document.getElementById("close-channel-manager"),
        cancelChannelManager: document.getElementById("cancel-channel-manager"),
        channelManagerForm: document.getElementById("channel-manager-form"),
        channelManagerType: document.getElementById("channel-manager-type"),
        channelManagerName: document.getElementById("channel-manager-name"),
        channelManagerPublico: document.getElementById("channel-manager-publico"),
        channelManagerPublicoOptions: document.getElementById("channel-manager-publico-options"),
        channelManagerDescription: document.getElementById("channel-manager-description"),
        channelManagerFeedback: document.getElementById("channel-manager-feedback"),
        channelManagerList: document.getElementById("channel-manager-list"),
        sidebarChannelList: document.getElementById("message-channel-list"),
        sidebarThreadList: document.getElementById("sidebar-thread-list"),
        sidebarThreadEmpty: document.getElementById("sidebar-thread-empty"),
        boardList: document.getElementById("message-board-list"),
        boardEmpty: document.getElementById("message-board-empty"),
        boardSummary: document.getElementById("message-board-summary"),
        tabBar: Array.from(document.querySelectorAll(".message-tab")),
        leftFilters: Array.from(document.querySelectorAll(".sidebar-quick-filter")),
        filterTurma: document.getElementById("filter-turma"),
        filterSetor: document.getElementById("filter-setor"),
        filterStatus: document.getElementById("filter-status"),
        filterUnread: document.getElementById("filter-unread"),
        threadEmpty: document.getElementById("thread-empty-state"),
        threadView: document.getElementById("thread-view"),
        threadBackButton: document.getElementById("thread-back-button"),
        threadHeader: document.getElementById("thread-header-panel"),
        threadActions: document.getElementById("thread-action-bar"),
        threadAlerts: document.getElementById("thread-alerts"),
        threadBody: document.getElementById("thread-body"),
        internalNotesPanel: document.getElementById("internal-notes-panel"),
        internalNotesList: document.getElementById("internal-notes-list"),
        quickTemplateList: document.getElementById("quick-template-list"),
        composerForm: document.getElementById("thread-composer-form"),
        attachmentInput: document.getElementById("thread-attachment-input"),
        attachmentPreviewList: document.getElementById("attachment-preview-list"),
        attachButton: document.getElementById("attach-message-button"),
        clearAttachmentsButton: document.getElementById("clear-attachments-button"),
        internalNoteButton: document.getElementById("internal-note-button"),
        typingIndicator: document.getElementById("typing-indicator"),
        composerInput: document.getElementById("thread-message-input"),
        composerContext: document.getElementById("composer-context"),
        composerFeedback: document.getElementById("thread-composer-feedback"),
        saveDraftButton: document.getElementById("save-draft-button"),
        sendMessageButton: document.getElementById("send-message-button"),
        statOpen: document.getElementById("stat-open-count"),
        statUnread: document.getElementById("stat-unread-count"),
        statApproval: document.getElementById("stat-approval-count"),
        viewToggles: Array.from(document.querySelectorAll(".message-view-toggle")),
        tabCountResponder: document.getElementById("tab-count-responder"),
        tabCountAprovar: document.getElementById("tab-count-aprovar"),
        tabCountTodas: document.getElementById("tab-count-todas"),
        tabCountArquivadas: document.getElementById("tab-count-arquivadas"),
        tabCountNaoLidas: document.getElementById("tab-count-nao-lidas")
      };

      const state = {
        session: session,
        directory: null,
        maps: null,
        storedChannels: [],
        allChannels: [],
        channels: [],
        actorContext: null,
        parsedMessages: [],
        threads: [],
        threadState: readThreadState(),
        viewState: readJson(THREAD_VIEW_KEY, {}),
        selectedChannelId: null,
        activeTab: "responder",
        leftFilter: localStorage.getItem(CHANNEL_FILTER_KEY) || "all",
        searchTerm: "",
        filters: {
          turma: "",
          sector: "",
          status: "",
          unread: "",
          channelId: ""
        },
        pendingAttachments: [],
        internalMode: false,
        refreshLock: false,
        typingTimer: null,
        forwardThread: null,
        selectedThreadKey: initialThreadParam || null,
        viewMode: normalizeViewMode(initialThreadParam ? "thread" : localStorage.getItem(MESSAGE_PANEL_MODE_KEY))
      };

      function rebuildThreads() {
        if (!state.directory || !state.maps) return;
        state.threads = sortThreads(buildThreadCollection(
          state.parsedMessages,
          session,
          state.actorContext,
          state.directory,
          state.channels,
          state.maps,
          state.threadState,
          state.viewState
        ));
      }

      async function loadData() {
        const [turmas, alunos, responsaveis, professores, equipe, storedChannels, storedMessages] = await Promise.all([
          window.AgendaGamaDataStore.list("turmas", DEFAULT_DIRECTORY.turmas),
          window.AgendaGamaDataStore.list("alunos", DEFAULT_DIRECTORY.alunos),
          window.AgendaGamaDataStore.list("responsaveis", DEFAULT_DIRECTORY.responsaveis),
          window.AgendaGamaDataStore.list("professores", DEFAULT_DIRECTORY.professores),
          window.AgendaGamaDataStore.list("equipe", DEFAULT_DIRECTORY.equipe),
          window.AgendaGamaDataStore.list("channels", STORED_CHANNELS_SEED),
          window.AgendaGamaDataStore.list("messages", DEFAULT_MESSAGES)
        ]);

        state.directory = { turmas: turmas, alunos: alunos, responsaveis: responsaveis, professores: professores, equipe: equipe };
        state.actorContext = getActorContext(session, state.directory);
        state.storedChannels = storedChannels;
        state.allChannels = getAllChannels(storedChannels, state.directory);
        state.channels = getVisibleChannelsForSession(session, state.actorContext, state.allChannels);

        state.maps = buildMaps(state.directory);
        state.parsedMessages = storedMessages.map(function (message) {
          return parseStoredMessage(message, state.directory, state.channels, state.maps);
        });
        rebuildThreads();
      }

      function getSelectedThread() {
        return state.threads.find(function (thread) { return thread.key === state.selectedThreadKey; }) || null;
      }

      function setViewMode(mode) {
        const nextMode = normalizeViewMode(mode);
        state.viewMode = nextMode;
        localStorage.setItem(MESSAGE_PANEL_MODE_KEY, nextMode);
      }

      function getVisibleSidebarThreads() {
        return sortThreads(filterSidebarThreads(state.threads, state.leftFilter, state.searchTerm, state.selectedChannelId));
      }

      function getVisibleBoardThreads() {
        return sortThreads(filterBoardThreads(state.threads, state));
      }

      function ensureSelections() {
        if (!state.channels.some(function (channel) { return channel.id === state.selectedChannelId; })) {
          state.selectedChannelId = "";
        }

        const boardThreads = getVisibleBoardThreads();
        const sidebarThreads = getVisibleSidebarThreads();
        const availableThread = boardThreads.find(function (thread) { return thread.key === state.selectedThreadKey; })
          || sidebarThreads.find(function (thread) { return thread.key === state.selectedThreadKey; })
          || boardThreads[0]
          || sidebarThreads[0]
          || null;

        state.selectedThreadKey = availableThread?.key || null;
      }

      function populateNewThreadOptions() {
        const currentThreadType = session.role === "responsaveis" ? "family" : String(refs.newThreadType.value || "family");
        const currentValues = {
          type: currentThreadType,
          channel: refs.newThreadChannel.value,
          student: refs.newThreadStudent.value,
          responsavel: refs.newThreadResponsavel.value,
          sector: refs.newThreadSector.value
        };

        const availableChannels = getAvailableChannelsForNewThread(currentThreadType, state.channels);

        refs.newThreadChannel.innerHTML = availableChannels.map(function (channel) {
          return `<option value="${escapeHtml(channel.id)}">${escapeHtml(channel.nome)}${channel.publico ? ` - ${escapeHtml(channel.publico)}` : ""}</option>`;
        }).join("");

        refs.newThreadSector.innerHTML = ["Secretaria", "Coordenacao", "Financeiro", "Professor"].map(function (sector) {
          return `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`;
        }).join("");

        refs.newThreadStudent.innerHTML = (state.directory.alunos || []).map(function (student) {
          return `<option value="${escapeHtml(student.id)}">${escapeHtml(student.nome)} - ${escapeHtml(student.turma)}</option>`;
        }).join("");

        refs.newThreadResponsavel.innerHTML = (state.directory.responsaveis || []).map(function (item) {
          return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome)} - ${escapeHtml(item.aluno || "Sem aluno")}</option>`;
        }).join("");

        if (session.role === "responsaveis") {
          const linkedStudents = getResponsibleLinkedStudents(state);
          refs.newThreadType.value = "family";
          refs.newThreadType.innerHTML = '<option value="family">Conversa com a escola</option>';
          refs.newThreadChannelField.hidden = true;
          refs.newThreadResponsavelField.hidden = true;
          refs.newThreadStudent.innerHTML = linkedStudents.map(function (student) {
            return `<option value="${escapeHtml(student.id)}">${escapeHtml(student.nome)} - ${escapeHtml(student.turma)}</option>`;
          }).join("");
        } else {
          refs.newThreadType.innerHTML = `
            <option value="family">Conversa com responsavel</option>
            <option value="broadcast">Canal da turma</option>
          `;
          refs.newThreadChannelField.hidden = false;
          refs.newThreadResponsavelField.hidden = false;
        }

        setSelectValueIfPresent(refs.newThreadType, session.role === "responsaveis" ? "family" : (currentValues.type || "family"));
        setSelectValueIfPresent(refs.newThreadChannel, currentValues.channel);
        setSelectValueIfPresent(refs.newThreadStudent, currentValues.student);
        setSelectValueIfPresent(refs.newThreadResponsavel, currentValues.responsavel);
        setSelectValueIfPresent(refs.newThreadSector, currentValues.sector || "Secretaria");
        syncNewThreadVisibility();
      }

      function syncNewThreadVisibility() {
        const threadType = session.role === "responsaveis" ? "family" : String(refs.newThreadType.value || "family");
        const isBroadcast = threadType === "broadcast";
        refs.newThreadChannelField.hidden = session.role === "responsaveis";
        refs.newThreadStudentField.hidden = isBroadcast;
        refs.newThreadResponsavelField.hidden = session.role === "responsaveis" || isBroadcast;

        const selectedStudent = (state.directory?.alunos || []).find(function (item) {
          return item.id === refs.newThreadStudent.value;
        }) || null;

        if (session.role === "responsaveis") {
          const suggestedChannel = pickThreadChannelForStudent(selectedStudent, state.channels);
          setSelectValueIfPresent(refs.newThreadChannel, suggestedChannel?.id || "");
        }

        if (!isBroadcast && selectedStudent && session.role !== "responsaveis") {
          const relatedResponsaveis = (state.directory.responsaveis || []).filter(function (item) {
            return item.aluno_id === selectedStudent.id || normalizeText(item.aluno) === normalizeText(selectedStudent.nome);
          });
          if (relatedResponsaveis.length && !relatedResponsaveis.some(function (item) { return item.id === refs.newThreadResponsavel.value; })) {
            refs.newThreadResponsavel.value = relatedResponsaveis[0].id;
          }
        }
      }

      function resetNewThreadFeedback() {
        refs.newThreadFeedback.textContent = "";
        refs.newThreadFeedback.className = "feedback";
      }

      function canManageChannels() {
        return session.role === "administrador" || session.role === "funcionarios" || session.canApprove;
      }

      function updateModalBodyState() {
        const hasOpenModal = !refs.newThreadModal?.hidden || !refs.channelManagerModal?.hidden;
        document.body.classList.toggle("message-modal-open", Boolean(hasOpenModal));
      }

      function getNewThreadFocusTarget() {
        if (!refs.newThreadStudentField.hidden) return refs.newThreadStudent;
        if (!refs.newThreadChannelField.hidden) return refs.newThreadChannel;
        return refs.newThreadSubject;
      }

      function openNewThreadModal() {
        if (!refs.newThreadModal) return;
        refs.newThreadModal.hidden = false;
        updateModalBodyState();
        resetNewThreadFeedback();
        window.requestAnimationFrame(function () {
          getNewThreadFocusTarget()?.focus();
        });
      }

      function closeNewThreadModal() {
        if (!refs.newThreadModal) return;
        refs.newThreadModal.hidden = true;
        updateModalBodyState();
        resetNewThreadFeedback();
      }

      function resetChannelManagerFeedback() {
        refs.channelManagerFeedback.textContent = "";
        refs.channelManagerFeedback.className = "feedback";
      }

      function populateChannelManagerOptions() {
        refs.channelManagerPublicoOptions.innerHTML = (state.directory?.turmas || []).map(function (turma) {
          return `<option value="${escapeHtml(turma.nome)}"></option>`;
        }).join("");
      }

      function isSystemChannel(channel) {
        return VIRTUAL_CHANNELS.some(function (item) { return item.id === channel.id; });
      }

      function getChannelConversationCount(channel) {
        return state.threads.filter(function (thread) {
          return thread.channelId === channel.id || normalizeText(thread.channelName) === normalizeText(channel.nome);
        }).length;
      }

      function renderChannelManagerList() {
        if (!refs.channelManagerList) return;

        refs.channelManagerList.innerHTML = state.allChannels.map(function (channel) {
          const systemChannel = isSystemChannel(channel);
          const conversationCount = getChannelConversationCount(channel);
          const channelTypeLabel = channel.channelType === "turma" ? "Turma" : systemChannel ? "Sistema" : "Canal";

          return `
            <article class="channel-manager-card">
              <div class="channel-manager-card-copy">
                <div class="channel-manager-card-head">
                  <strong>${escapeHtml(channel.nome)}</strong>
                  <div class="inline-tags">
                    <span class="tag">${escapeHtml(channelTypeLabel)}</span>
                    <span class="tag">${escapeHtml(channel.publico || "Sem publico")}</span>
                  </div>
                </div>
                <p>${escapeHtml(channel.descricao || "Canal sem descricao cadastrada.")}</p>
                <small>${escapeHtml(`${conversationCount} conversa(s) vinculada(s)`)}</small>
              </div>
              <div class="channel-manager-card-actions">
                ${systemChannel ? '<span class="muted">Canal do sistema</span>' : `<button type="button" class="btn btn-secondary btn-sm" data-channel-remove-id="${escapeHtml(channel.id)}">Excluir</button>`}
              </div>
            </article>
          `;
        }).join("") || '<p class="empty-state">Nenhum canal disponivel no momento.</p>';
      }

      function openChannelManagerModal() {
        if (!refs.channelManagerModal || !canManageChannels()) return;
        refs.channelManagerModal.hidden = false;
        updateModalBodyState();
        refs.channelManagerForm?.reset();
        refs.channelManagerType.value = "turma";
        resetChannelManagerFeedback();
        populateChannelManagerOptions();
        renderChannelManagerList();
        window.requestAnimationFrame(function () {
          refs.channelManagerName?.focus();
        });
      }

      function closeChannelManagerModal() {
        if (!refs.channelManagerModal) return;
        refs.channelManagerModal.hidden = true;
        updateModalBodyState();
        refs.channelManagerForm?.reset();
        resetChannelManagerFeedback();
      }

      function populateFilterOptions() {
        const turmas = [...new Set(state.threads.map(function (thread) { return thread.turma; }).filter(Boolean))];
        const sectors = [...new Set(state.threads.map(function (thread) { return thread.sector; }).filter(Boolean))];
        const statuses = ["Aguardando resposta", "Aguardando retorno", "Aguardando aprovacao", "Aprovada", "Respondida", "Enviada", "Encerrada", "Arquivada"];

        refs.filterTurma.innerHTML = ['<option value="">Todas</option>'].concat(turmas.map(function (item) {
          return `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        })).join("");

        refs.filterSetor.innerHTML = ['<option value="">Todos</option>'].concat(sectors.map(function (item) {
          return `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        })).join("");

        refs.filterStatus.innerHTML = ['<option value="">Todos</option>'].concat(statuses.map(function (item) {
          return `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        })).join("");

        refs.filterUnread.innerHTML = `
          <option value="">Todas</option>
          <option value="nao-lidas">Nao lidas</option>
          <option value="lidas">Lidas</option>
        `;
      }

      function renderStats() {
        const activeThreads = state.threads.filter(function (thread) { return !thread.local.archived && !thread.local.resolved; }).length;
        const unreadThreads = state.threads.filter(function (thread) { return thread.unreadCount > 0; }).length;
        const approvalThreads = state.threads.filter(function (thread) { return thread.pendingApprovalCount > 0; }).length;

        refs.statOpen.textContent = String(activeThreads).padStart(2, "0");
        refs.statUnread.textContent = String(unreadThreads).padStart(2, "0");
        refs.statApproval.textContent = String(approvalThreads).padStart(2, "0");
      }

      function renderTabs() {
        const counts = {
          responder: state.threads.filter(function (thread) { return matchesBoardTab(thread, "responder"); }).length,
          aprovar: state.threads.filter(function (thread) { return matchesBoardTab(thread, "aprovar"); }).length,
          todas: state.threads.filter(function (thread) { return matchesBoardTab(thread, "todas"); }).length,
          arquivadas: state.threads.filter(function (thread) { return matchesBoardTab(thread, "arquivadas"); }).length,
          "nao-lidas": state.threads.filter(function (thread) { return matchesBoardTab(thread, "nao-lidas"); }).length
        };

        refs.tabCountResponder.textContent = String(counts.responder);
        refs.tabCountAprovar.textContent = String(counts.aprovar);
        refs.tabCountTodas.textContent = String(counts.todas);
        refs.tabCountArquivadas.textContent = String(counts.arquivadas);
        refs.tabCountNaoLidas.textContent = String(counts["nao-lidas"]);

        refs.tabBar.forEach(function (button) {
          button.classList.toggle("active", button.dataset.tab === state.activeTab);
        });
      }

      function renderChannelList() {
        refs.sidebarChannelList.innerHTML = state.channels.map(function (channel) {
          const relatedThreads = state.threads.filter(function (thread) {
            return thread.channelId === channel.id || thread.channelName === channel.nome;
          });
          const unreadCount = relatedThreads.filter(function (thread) { return thread.unreadCount > 0; }).length;
          const count = unreadCount || relatedThreads.length;

          return `
            <button type="button" class="message-channel-card ${state.selectedChannelId === channel.id ? "active" : ""}" data-channel-id="${escapeHtml(channel.id)}">
              ${renderAvatar(channel.nome)}
              <span class="message-channel-copy">
                <strong>${escapeHtml(channel.nome)}</strong>
                <small>${escapeHtml(channel.publico || channel.descricao || "")}</small>
              </span>
              <span class="message-pill-count">${String(count).padStart(2, "0")}</span>
            </button>
          `;
        }).join("");
      }

      function renderSidebarThreads() {
        const threads = getVisibleSidebarThreads();
        refs.sidebarThreadEmpty.hidden = threads.length > 0;
        refs.sidebarThreadList.innerHTML = threads.map(function (thread) {
          const title = getThreadTitle(thread);
          const subtitle = getThreadSubtitle(thread);
          const status = buildStatusBadge(thread.cardStatus);
          const utilityTags = [
            thread.local.urgent ? '<span class="tag">Urgente</span>' : "",
            thread.local.pinned ? '<span class="tag">Fixada</span>' : ""
          ].filter(Boolean).join("");

          return `
            <button type="button" class="message-sidebar-thread ${state.selectedThreadKey === thread.key ? "active" : ""}" data-thread-key="${escapeHtml(thread.key)}">
              ${renderAvatar(title)}
              <span class="message-sidebar-thread-copy">
                <span class="message-sidebar-line">
                  <strong>${escapeHtml(title)}</strong>
                  <small>${escapeHtml(formatShortTime(thread.lastMessage?.created_at))}</small>
                </span>
                <span class="message-sidebar-line secondary">
                  <span>${escapeHtml(subtitle)}</span>
                  ${thread.unreadCount ? `<span class="message-pill-count accent">${thread.unreadCount}</span>` : ""}
                </span>
                <span class="message-sidebar-tags">${status}${utilityTags}</span>
                <span class="message-sidebar-preview">${escapeHtml(thread.lastMessage?.parsed?.text || "Sem mensagens ainda.")}</span>
              </span>
            </button>
          `;
        }).join("");
      }

      function renderBoard() {
        const threads = getVisibleBoardThreads();
        refs.boardEmpty.hidden = threads.length > 0;
        refs.boardSummary.innerHTML = `
          <div class="message-board-summary-grid">
            <span class="tag">${escapeHtml(state.selectedChannelId ? "Canal filtrado" : "Todos os canais")}</span>
            <p>${escapeHtml(`Exibindo ${threads.length} conversa(s) na aba ${refs.tabBar.find(function (item) { return item.dataset.tab === state.activeTab; })?.textContent?.replace(/\d+/g, "").trim() || "Todas"}.`)}</p>
          </div>
        `;

        refs.boardList.innerHTML = threads.map(function (thread) {
          const title = getThreadTitle(thread);
          const subtitle = getThreadSubtitle(thread);
          const preview = getThreadPreview(thread);
          const labels = [
            buildStatusBadge(thread.cardStatus),
            thread.sector ? `<span class="tag">${escapeHtml(thread.sector)}</span>` : "",
            thread.local.urgent ? '<span class="tag">Urgente</span>' : "",
            thread.local.pinned ? '<span class="tag">Fixada</span>' : ""
          ].filter(Boolean).join("");
          const actions = session.role === "responsaveis" ? "" : `
            <div class="message-board-actions">
              <button type="button" class="message-board-action btn btn-secondary btn-sm" data-action="assign">${thread.local.assignedEmail ? "Reassumir" : "Assumir"}</button>
              <button type="button" class="message-board-action btn btn-secondary btn-sm" data-action="pin">${thread.local.pinned ? "Desafixar" : "Fixar"}</button>
              <button type="button" class="message-board-action btn btn-secondary btn-sm" data-action="urgent">${thread.local.urgent ? "Remover urgente" : "Urgente"}</button>
              <button type="button" class="message-board-action btn btn-secondary btn-sm" data-action="resolve">${thread.local.resolved ? "Reabrir" : "Resolver"}</button>
              <button type="button" class="message-board-action btn btn-secondary btn-sm" data-action="archive">${thread.local.archived ? "Desarquivar" : "Arquivar"}</button>
              <button type="button" class="message-board-action btn btn-secondary btn-sm" data-action="forward">Encaminhar</button>
              <button type="button" class="message-board-action btn btn-secondary btn-sm danger-action" data-action="delete-thread">Excluir conversa</button>
            </div>
          `;

          return `
            <article class="message-board-card ${state.selectedThreadKey === thread.key ? "active" : ""} ${session.role === "responsaveis" ? "" : "has-actions"}" data-thread-card="${escapeHtml(thread.key)}">
              <button type="button" class="message-board-open" data-thread-open-key="${escapeHtml(thread.key)}">
                <div class="message-board-avatar">${escapeHtml(getInitials(title))}</div>
                <div class="message-board-copy">
                  <div class="message-board-headline">
                    <div>
                      <strong>${escapeHtml(title)}</strong>
                      <p>${escapeHtml(subtitle)}</p>
                    </div>
                    <div class="message-board-meta">
                      <small>${escapeHtml(formatShortTime(thread.lastMessage?.created_at))}</small>
                      ${thread.unreadCount ? `<span class="message-pill-count accent">${thread.unreadCount}</span>` : ""}
                    </div>
                  </div>
                  <div class="message-board-tags">${labels}</div>
                  <p class="message-board-subject">${escapeHtml(thread.subject || "Atendimento escolar")}</p>
                  <p class="message-board-preview">${escapeHtml(preview)}</p>
                </div>
              </button>
              ${actions}
            </article>
          `;
        }).join("");
      }

      function renderThread() {
        const thread = getSelectedThread();
        const readOnlyThread = isReadOnlyThread(thread, session);
        refs.threadEmpty.hidden = Boolean(thread);
        refs.threadView.hidden = !thread;

        if (!thread) {
          refs.threadHeader.innerHTML = "";
          refs.threadActions.innerHTML = "";
          refs.threadActions.hidden = true;
          refs.threadAlerts.innerHTML = "";
          refs.threadBody.innerHTML = "";
          refs.internalNotesList.innerHTML = "";
          refs.quickTemplateList.innerHTML = "";
          refs.composerContext.textContent = "";
          refs.composerInput.disabled = true;
          return;
        }

        const pendingMessage = thread.messages.find(function (message) {
          return message.workflowStatus === "pending_approval";
        }) || null;

        refs.threadHeader.innerHTML = `
          <div class="thread-header-main">
            <div class="thread-header-copy">
              <div class="thread-title-row">
                ${renderAvatar(getThreadTitle(thread))}
                <div>
                  <h2>${escapeHtml(getThreadTitle(thread))}</h2>
                  <p>${escapeHtml(getThreadSubtitle(thread))}</p>
                </div>
              </div>
              <div class="thread-header-tags">
                ${buildStatusBadge(thread.cardStatus)}
                ${thread.sector ? `<span class="tag">${escapeHtml(thread.sector)}</span>` : ""}
                <span class="tag">Atendendo: ${escapeHtml(thread.local.assignedTo || "Nao assumido")}</span>
                ${thread.local.urgent ? '<span class="tag">Urgente</span>' : ""}
              </div>
            </div>
            <div class="thread-header-side">
              <span class="tag">${escapeHtml(thread.subject || "Atendimento escolar")}</span>
              <small>Atualizado em ${escapeHtml(formatShortTime(thread.lastMessage?.created_at))}</small>
            </div>
          </div>
        `;

        refs.threadActions.innerHTML = "";
        refs.threadActions.hidden = true;

        if (session.canApprove && thread.pendingApprovalCount > 0) {
          refs.threadAlerts.innerHTML = `
            <article class="hint-box">
              <div class="section-heading compact-heading">
                <div>
                  <h2>Aprovacao pendente</h2>
                  <p>${escapeHtml(`${thread.pendingApprovalCount} mensagem(ns) aguardando aprovacao nesta conversa.`)}</p>
                  ${pendingMessage ? `<small>${escapeHtml(`Ultima pendencia de ${pendingMessage.sender_name} em ${formatShortTime(pendingMessage.created_at)}.`)}</small>` : ""}
                </div>
                <div class="toolbar">
                  <button type="button" class="btn btn-secondary btn-sm approval-action" data-action="return">Devolver</button>
                  <button type="button" class="btn btn-secondary btn-sm approval-action" data-action="reject">Rejeitar</button>
                  <button type="button" class="btn btn-primary btn-sm approval-action" data-action="approve">Aprovar</button>
                </div>
              </div>
            </article>
          `;
        } else if (readOnlyThread) {
          refs.threadAlerts.innerHTML = `
            <article class="hint-box">
              <div class="section-heading compact-heading">
                <div>
                  <h2>Canal informativo</h2>
                  <p>Familias visualizam esse canal como leitura. Para falar com a escola, abra uma conversa individual.</p>
                </div>
              </div>
            </article>
          `;
        } else {
          refs.threadAlerts.innerHTML = "";
        }

        refs.threadBody.innerHTML = thread.visibleMessages.length
          ? groupMessagesByDate(thread.visibleMessages).map(function (group) {
            return `
              <div class="thread-date-group">
                <div class="thread-date-divider"><span>${escapeHtml(group.label)}</span></div>
                <div class="thread-message-stack">
                  ${group.items.map(function (message) {
                    const mine = normalizeEmail(message.sender_email) === normalizeEmail(session.email);
                    const canDelete = canDeleteMessage(message, thread, session);
                    const attachments = message.parsed.attachments.map(function (item) {
                      return `<a class="message-attachment" href="${escapeHtml(item.dataUrl || "#")}" download="${escapeHtml(item.name)}">${escapeHtml(item.name)} <small>${escapeHtml(formatBytes(item.size))}</small></a>`;
                    }).join("");

                    return `
                      <article class="thread-bubble ${mine ? "mine" : ""} ${message.parsed.internalOnly ? "internal" : ""}">
                        <div class="thread-bubble-head">
                          <strong>${escapeHtml(message.sender_name)}</strong>
                          <span>${escapeHtml(formatShortTime(message.created_at))}</span>
                        </div>
                        <p>${escapeHtml(message.parsed.text)}</p>
                        ${attachments ? `<div class="message-attachment-list">${attachments}</div>` : ""}
                        <div class="thread-bubble-meta">
                          ${buildStatusBadge(getWorkflowLabel(message.workflowStatus))}
                          ${canDelete ? `<button type="button" class="thread-message-delete btn btn-secondary btn-sm" data-message-remove-id="${escapeHtml(message.id)}">Excluir</button>` : ""}
                        </div>
                      </article>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")
          : `
            <article class="thread-start-placeholder">
              <strong>Conversa iniciada</strong>
              <p>Esse atendimento ja esta aberto. Use o campo abaixo para enviar a primeira mensagem no chat.</p>
            </article>
          `;

        refs.internalNotesPanel.hidden = session.role === "responsaveis" || thread.internalNotes.length === 0;
        refs.internalNotesList.innerHTML = thread.internalNotes.map(function (message) {
          return `
            <article class="internal-note-card">
              <strong>${escapeHtml(message.sender_name)}</strong>
              <p>${escapeHtml(message.parsed.text)}</p>
              <small>${escapeHtml(formatShortTime(message.created_at))}</small>
            </article>
          `;
        }).join("");

        refs.quickTemplateList.innerHTML = QUICK_TEMPLATES.map(function (template) {
          return `<button type="button" class="quick-template-chip" data-template-id="${escapeHtml(template.id)}">${escapeHtml(template.label)}</button>`;
        }).join("");

        const canReply = canReplyToThread(thread, session);
        refs.composerContext.textContent = getComposerContext(thread, session, state.internalMode);
        refs.composerInput.disabled = !canReply;
        refs.attachButton.disabled = !canReply;
        refs.attachmentInput.disabled = !canReply;
        refs.saveDraftButton.disabled = !canReply;
        refs.sendMessageButton.disabled = !canReply;
        refs.internalNoteButton.hidden = session.role === "responsaveis";
        refs.internalNoteButton.disabled = !canReply;
        refs.composerForm.classList.toggle("is-read-only", !canReply);
        refs.composerInput.placeholder = isReadOnlyThread(thread, session)
          ? "Esse canal e somente leitura para a familia."
          : !canReply
            ? "Assuma essa conversa para responder."
            : "Escreva sua resposta ou observacao interna";
      }

      function renderAttachmentPreview() {
        refs.attachmentPreviewList.hidden = state.pendingAttachments.length === 0;
        refs.clearAttachmentsButton.hidden = state.pendingAttachments.length === 0;
        refs.attachmentPreviewList.innerHTML = state.pendingAttachments.map(function (item) {
          return `<span class="attachment-chip">${escapeHtml(item.name)} <small>${escapeHtml(formatBytes(item.size))}</small></span>`;
        }).join("");
      }

      function syncUrlState() {
        const url = new URL(window.location.href);
        if (state.viewMode === "thread" && state.selectedThreadKey) {
          url.searchParams.set("thread", state.selectedThreadKey);
        } else {
          url.searchParams.delete("thread");
        }
        window.history.replaceState({}, "", url);
      }

      function buildNotificationAlerts() {
        return state.threads.flatMap(function (thread) {
          const alerts = [];

          if (thread.unreadCount > 0) {
            alerts.push({
              kind: "communication-thread",
              dedupeKey: `thread:${thread.key}`,
              threadKey: thread.key,
              title: session.role === "responsaveis"
                ? (thread.type === "broadcast" ? `Novo aviso em ${thread.channelName}` : "Nova resposta da escola")
                : `Nova mensagem em ${getThreadTitle(thread)}`,
              body: session.role === "responsaveis"
                ? `${thread.studentName || thread.turma || thread.channelName} • ${getThreadPreview(thread)}`
                : `${thread.studentName || thread.turma || thread.sector || "Atendimento"} • ${getThreadPreview(thread)}`,
              createdAt: thread.lastMessage?.created_at || new Date().toISOString(),
              sourceStamp: thread.lastMessage?.created_at || `${thread.key}:${thread.unreadCount}`
            });
          }

          if (session.canApprove && thread.pendingApprovalCount > 0) {
            alerts.push({
              kind: "communication-approval",
              dedupeKey: `approval:${thread.key}`,
              threadKey: thread.key,
              title: "Mensagem aguardando aprovacao",
              body: `${thread.pendingApprovalCount} mensagem(ns) pendente(s) em ${getThreadTitle(thread)}.`,
              createdAt: thread.lastMessage?.created_at || new Date().toISOString(),
              sourceStamp: `${thread.pendingApprovalCount}:${thread.lastMessage?.created_at || thread.key}`
            });
          }

          return alerts;
        });
      }

      function renderAll() {
        ensureSelections();
        populateNewThreadOptions();
        populateChannelManagerOptions();
        populateFilterOptions();
        renderStats();
        renderTabs();
        renderChannelList();
        renderChannelManagerList();
        renderSidebarThreads();
        renderBoard();
        renderThread();
        renderAttachmentPreview();
        if (refs.openChannelManager) {
          refs.openChannelManager.hidden = !canManageChannels();
        }
        refs.leftFilters.forEach(function (button) {
          button.classList.toggle("active", button.dataset.leftFilter === state.leftFilter);
        });
        refs.filterTurma.value = state.filters.turma;
        refs.filterSetor.value = state.filters.sector;
        refs.filterStatus.value = state.filters.status;
        refs.filterUnread.value = state.filters.unread;
        refs.layout?.classList.toggle("is-board-view", state.viewMode === "board");
        refs.layout?.classList.toggle("is-thread-view", state.viewMode === "thread");
        refs.viewToggles.forEach(function (button) {
          button.classList.toggle("active", button.dataset.view === state.viewMode);
        });
        syncUrlState();
        window.AgendaGamaApp?.syncCommunicationNotifications?.(session, buildNotificationAlerts());
      }

      async function refreshAll() {
        if (state.refreshLock) return;
        state.refreshLock = true;
        try {
          await loadData();
          const thread = getSelectedThread();
          if (thread?.lastMessage?.created_at) {
            state.viewState = markThreadRead(state.viewState, session, thread.key, thread.lastMessage.created_at);
            rebuildThreads();
          }
          renderAll();
        } finally {
          state.refreshLock = false;
        }
      }

      async function saveMessage(thread, options) {
        const message = {
          canal_id: thread.channelId || null,
          canal_nome: thread.channelName,
          sender_name: session.name,
          sender_email: session.email,
          sender_role: session.role,
          recipient_type: options.internalOnly ? "interno" : options.recipientType,
          recipients: options.recipients,
          subject: thread.subject || thread.channelName,
          content: encodeEnvelope({
            text: options.text,
            internalOnly: Boolean(options.internalOnly),
            attachments: options.attachments || [],
            placeholder: Boolean(options.placeholder),
            thread: {
              key: thread.key,
              type: thread.type,
              channelId: thread.channelId || null,
              channelName: thread.channelName,
              channelType: thread.channelType || "turma",
              sector: thread.sector,
              responsibleId: thread.responsibleId || null,
              responsibleName: thread.responsibleName || "",
              responsibleEmail: thread.responsibleEmail || "",
              studentId: thread.studentId || null,
              studentName: thread.studentName || "",
              turma: thread.turma || "",
              subject: thread.subject || thread.channelName
            }
          }),
          status: options.workflowStatus,
          approved_by: options.workflowStatus === "approved" || (options.workflowStatus === "sent" && session.canApprove && !options.internalOnly) ? session.name : "",
          sent_by: options.workflowStatus === "sent" ? session.name : "",
          created_at: nowIso()
        };

        return await window.AgendaGamaDataStore.save("messages", message, DEFAULT_MESSAGES);
      }

      function appendSavedMessage(savedMessage) {
        if (!savedMessage) return;
        const parsedMessage = parseStoredMessage(savedMessage, state.directory, state.channels, state.maps);
        state.parsedMessages = state.parsedMessages.concat(parsedMessage);
        rebuildThreads();
        const thread = state.threads.find(function (item) {
          return item.key === parsedMessage.parsed.thread?.key;
        }) || null;
        if (thread?.lastMessage?.created_at) {
          state.viewState = markThreadRead(state.viewState, session, thread.key, thread.lastMessage.created_at);
          rebuildThreads();
        }
      }

      async function handleComposerSubmit(mode) {
        const thread = getSelectedThread();
        if (!thread) return;
        if (!canReplyToThread(thread, session)) {
          refs.composerFeedback.textContent = isReadOnlyThread(thread, session)
            ? "Esse canal e somente leitura para a familia."
            : "Assuma essa conversa para responder em tempo real.";
          refs.composerFeedback.className = "feedback error";
          return;
        }

        const text = String(refs.composerInput.value || "").trim();
        if (!text) {
          refs.composerFeedback.textContent = "Digite uma mensagem para continuar.";
          refs.composerFeedback.className = "feedback error";
          return;
        }

        const internalOnly = state.internalMode && session.role !== "responsaveis";
        const workflowStatus = mode === "draft"
          ? "draft"
          : internalOnly
            ? "sent"
            : session.role === "responsaveis" || session.canApprove
              ? "sent"
              : isAssignedToCurrentUser(thread, session)
                ? "sent"
                : "pending_approval";
        const recipientType = thread.type === "broadcast"
          ? "turmas"
          : session.role === "responsaveis"
            ? "escola"
            : "responsaveis";
        const recipients = thread.type === "broadcast"
          ? getBroadcastRecipients(state.directory, thread.turma, thread.channelName)
          : session.role === "responsaveis"
            ? [thread.sector || thread.channelName]
            : [thread.responsibleEmail || thread.responsibleName];

        if (thread.type === "broadcast" && !recipients.length) {
          refs.composerFeedback.textContent = "Esse canal nao possui responsaveis vinculados a turma selecionada.";
          refs.composerFeedback.className = "feedback error";
          return;
        }

        const savedMessage = await saveMessage(thread, {
          text: text,
          internalOnly: internalOnly,
          attachments: state.pendingAttachments,
          workflowStatus: workflowStatus,
          recipientType: recipientType,
          recipients: recipients
        });
        appendSavedMessage(savedMessage);

        refs.composerInput.value = "";
        state.pendingAttachments = [];
        state.internalMode = false;
        refs.internalNoteButton.classList.remove("active");
        refs.typingIndicator.hidden = true;
        refs.composerFeedback.textContent = mode === "draft"
          ? "Mensagem salva como rascunho."
          : workflowStatus === "pending_approval"
            ? "Mensagem enviada para aprovacao."
            : "Mensagem enviada com sucesso.";
        refs.composerFeedback.className = "feedback success";
        renderAll();
        refs.composerInput.focus();
      }

      async function handleNewThreadSubmit(event) {
        event.preventDefault();
        const formData = new FormData(refs.newThreadForm);
        const student = (state.directory.alunos || []).find(function (item) { return item.id === formData.get("studentId"); }) || null;
        const channel = state.channels.find(function (item) { return item.id === formData.get("channelId"); })
          || (session.role === "responsaveis" ? pickThreadChannelForStudent(student, state.channels) : null)
          || VIRTUAL_CHANNELS[0];
        const responsavel = session.role === "responsaveis"
          ? state.actorContext.responsavelRecords.find(function (item) { return item.aluno_id === student?.id; }) || state.actorContext.responsavelRecords[0] || null
          : (state.directory.responsaveis || []).find(function (item) { return item.id === formData.get("responsavelId"); }) || null;
        const threadType = String(formData.get("threadType") || "family");
        const sector = String(formData.get("sector") || "Secretaria");
        const subject = String(formData.get("subject") || "").trim() || "Atendimento escolar";

        if (!channel) {
          refs.newThreadFeedback.textContent = "Nao foi possivel localizar um canal para esse atendimento.";
          refs.newThreadFeedback.className = "feedback error";
          return;
        }
        if (threadType === "broadcast" && channel.channelType !== "turma") {
          refs.newThreadFeedback.textContent = "Para envio geral, selecione um canal vinculado a uma turma.";
          refs.newThreadFeedback.className = "feedback error";
          return;
        }
        if (threadType !== "broadcast" && !student) {
          refs.newThreadFeedback.textContent = "Selecione um aluno vinculado para abrir a conversa.";
          refs.newThreadFeedback.className = "feedback error";
          return;
        }
        if (threadType !== "broadcast" && !responsavel) {
          refs.newThreadFeedback.textContent = "Selecione um responsavel para continuar.";
          refs.newThreadFeedback.className = "feedback error";
          return;
        }

        const thread = threadType === "broadcast" ? {
          key: `broadcast:${channel.id}`,
          type: "broadcast",
          channelId: channel.id,
          channelName: channel.nome,
          channelType: channel.channelType || "turma",
          sector: sector,
          turma: channel.publico || student?.turma || ""
        } : {
          key: `family:${channel.id}:${responsavel?.id || normalizeEmail(responsavel?.email || session.email)}:${slugify(sector) || "secretaria"}`,
          type: "family",
          channelId: channel.id,
          channelName: channel.nome,
          channelType: channel.channelType || "turma",
          sector: sector,
          responsibleId: responsavel?.id || null,
          responsibleName: responsavel?.nome || session.name,
          responsibleEmail: responsavel?.email || session.email,
          studentId: student?.id || responsavel?.aluno_id || null,
          studentName: student?.nome || responsavel?.aluno || "",
          turma: student?.turma || channel.publico || "",
          subject: subject
        };

        const broadcastRecipients = thread.type === "broadcast"
          ? getBroadcastRecipients(state.directory, thread.turma, channel.nome)
          : [];
        if (thread.type === "broadcast" && !broadcastRecipients.length) {
          refs.newThreadFeedback.textContent = "Nenhum responsavel vinculado foi encontrado para essa turma.";
          refs.newThreadFeedback.className = "feedback error";
          return;
        }

        const savedMessage = await saveMessage(thread, {
          text: "",
          internalOnly: false,
          attachments: [],
          placeholder: true,
          workflowStatus: "draft",
          recipientType: thread.type === "broadcast" ? "turmas" : session.role === "responsaveis" ? "escola" : "responsaveis",
          recipients: thread.type === "broadcast"
            ? broadcastRecipients
            : session.role === "responsaveis"
              ? [thread.sector || channel.nome]
              : [thread.responsibleEmail || thread.responsibleName]
        });
        appendSavedMessage(savedMessage);

        state.selectedChannelId = channel.id;
        state.selectedThreadKey = thread.key;
        setViewMode("thread");
        refs.newThreadForm.reset();
        closeNewThreadModal();
        renderAll();
        refs.composerFeedback.textContent = "Conversa criada com sucesso. Digite a primeira mensagem no chat.";
        refs.composerFeedback.className = "feedback success";
        refs.composerInput.focus();
      }

      async function handleChannelManagerSubmit(event) {
        event.preventDefault();
        const channelType = String(refs.channelManagerType.value || "turma");
        const rawName = String(refs.channelManagerName.value || "").trim();
        const rawPublico = String(refs.channelManagerPublico.value || "").trim();
        const rawDescription = String(refs.channelManagerDescription.value || "").trim();
        const matchedTurma = (state.directory.turmas || []).find(function (turma) {
          return normalizeText(turma.nome) === normalizeText(rawPublico);
        }) || null;
        const publico = matchedTurma?.nome || rawPublico;
        const nome = rawName || (channelType === "turma" && publico ? `Canal ${publico}` : "");

        if (!nome) {
          refs.channelManagerFeedback.textContent = "Informe o nome do canal para continuar.";
          refs.channelManagerFeedback.className = "feedback error";
          return;
        }

        if (!publico) {
          refs.channelManagerFeedback.textContent = "Informe a turma ou publico deste canal.";
          refs.channelManagerFeedback.className = "feedback error";
          return;
        }

        const duplicatedChannel = state.storedChannels.find(function (channel) {
          return normalizeText(channel.nome) === normalizeText(nome)
            && normalizeText(channel.publico) === normalizeText(publico);
        });
        if (duplicatedChannel) {
          refs.channelManagerFeedback.textContent = "Ja existe um canal com esse nome e esse publico.";
          refs.channelManagerFeedback.className = "feedback error";
          return;
        }

        const nextChannel = withDerivedChannelType({
          nome: nome,
          publico: publico,
          descricao: rawDescription || (channelType === "turma"
            ? `Canal geral da turma ${publico} para recados e comunicados.`
            : "Canal complementar de atendimento escolar."),
          created_by_name: session.name,
          created_at: nowIso()
        }, state.directory);

        await window.AgendaGamaDataStore.save("channels", {
          nome: nextChannel.nome,
          publico: nextChannel.publico,
          descricao: nextChannel.descricao,
          created_by_name: nextChannel.created_by_name,
          created_at: nextChannel.created_at
        }, STORED_CHANNELS_SEED);

        refs.channelManagerForm.reset();
        refs.channelManagerType.value = "turma";
        refs.channelManagerFeedback.textContent = "Canal criado com sucesso.";
        refs.channelManagerFeedback.className = "feedback success";
        await refreshAll();
      }

      async function handleChannelRemove(channelId) {
        const channel = state.storedChannels.find(function (item) { return item.id === channelId; }) || null;
        if (!channel) return;

        const relatedMessages = state.parsedMessages.filter(function (message) {
          return message.canal_id === channel.id
            || normalizeText(message.canal_nome) === normalizeText(channel.nome);
        });
        const conversationCount = getChannelConversationCount(channel);
        const confirmText = conversationCount > 0
          ? `Esse canal tem ${conversationCount} conversa(s) vinculada(s) e ${relatedMessages.length} mensagem(ns). Deseja excluir tudo mesmo assim?`
          : "Deseja excluir este canal?";

        if (!window.confirm(confirmText)) return;

        [...new Set(relatedMessages.map(function (message) { return message.parsed.thread?.key; }).filter(Boolean))].forEach(function (threadKey) {
          removeThreadState(threadKey);
          removeThreadViewState(threadKey);
        });
        await Promise.all(relatedMessages.map(function (message) {
          return window.AgendaGamaDataStore.remove("messages", message.id, DEFAULT_MESSAGES);
        }));
        await window.AgendaGamaDataStore.remove("channels", channel.id, STORED_CHANNELS_SEED);
        refs.channelManagerFeedback.textContent = "Canal e mensagens vinculadas excluidos com sucesso.";
        refs.channelManagerFeedback.className = "feedback success";
        await refreshAll();
      }

      async function handleMessageRemove(messageId) {
        const thread = getSelectedThread();
        const message = state.parsedMessages.find(function (item) { return item.id === messageId; }) || null;
        if (!thread || !message) return;
        if (!canDeleteMessage(message, thread, session)) {
          refs.composerFeedback.textContent = "Voce nao tem permissao para excluir essa mensagem.";
          refs.composerFeedback.className = "feedback error";
          return;
        }

        if (!window.confirm("Deseja excluir esta mensagem?")) return;

        await window.AgendaGamaDataStore.remove("messages", message.id, DEFAULT_MESSAGES);
        if ((thread.messages || []).length <= 1) {
          removeThreadState(thread.key);
          removeThreadViewState(thread.key);
          state.selectedThreadKey = null;
          setViewMode("board");
        }
        refs.composerFeedback.textContent = "Mensagem excluida com sucesso.";
        refs.composerFeedback.className = "feedback success";
        await refreshAll();
      }

      async function handleThreadRemove(thread) {
        if (!thread) return;

        const relatedMessages = state.parsedMessages.filter(function (message) {
          return message.parsed.thread?.key === thread.key;
        });

        if (!relatedMessages.length) return;

        const confirmText = `Deseja excluir esta conversa e as ${relatedMessages.length} mensagem(ns) vinculada(s)?`;
        if (!window.confirm(confirmText)) return;

        await Promise.all(relatedMessages.map(function (message) {
          return window.AgendaGamaDataStore.remove("messages", message.id, DEFAULT_MESSAGES);
        }));

        removeThreadState(thread.key);
        removeThreadViewState(thread.key);
        state.selectedThreadKey = null;
        setViewMode("board");
        refs.composerFeedback.textContent = "Conversa excluida com sucesso.";
        refs.composerFeedback.className = "feedback success";
        await refreshAll();
      }

      refs.toggleNewThread?.addEventListener("click", function () {
        openNewThreadModal();
      });

      refs.openChannelManager?.addEventListener("click", function () {
        openChannelManagerModal();
      });

      refs.cancelNewThread?.addEventListener("click", function () {
        closeNewThreadModal();
      });

      refs.closeNewThread?.addEventListener("click", function () {
        closeNewThreadModal();
      });

      refs.newThreadModal?.addEventListener("click", function (event) {
        if (!event.target.closest("[data-close-new-thread]")) return;
        closeNewThreadModal();
      });

      refs.cancelChannelManager?.addEventListener("click", function () {
        closeChannelManagerModal();
      });

      refs.closeChannelManager?.addEventListener("click", function () {
        closeChannelManagerModal();
      });

      refs.channelManagerModal?.addEventListener("click", function (event) {
        if (!event.target.closest("[data-close-channel-manager]")) return;
        closeChannelManagerModal();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        if (!refs.channelManagerModal?.hidden) {
          closeChannelManagerModal();
          return;
        }
        if (!refs.newThreadModal?.hidden) {
          closeNewThreadModal();
        }
      });

      refs.newThreadForm?.addEventListener("submit", function (event) {
        handleNewThreadSubmit(event).catch(function (error) {
          refs.newThreadFeedback.textContent = error?.message || "Nao foi possivel criar a conversa.";
          refs.newThreadFeedback.className = "feedback error";
        });
      });

      refs.channelManagerForm?.addEventListener("submit", function (event) {
        handleChannelManagerSubmit(event).catch(function (error) {
          refs.channelManagerFeedback.textContent = error?.message || "Nao foi possivel criar o canal.";
          refs.channelManagerFeedback.className = "feedback error";
        });
      });

      refs.channelManagerList?.addEventListener("click", function (event) {
        const removeButton = event.target.closest("[data-channel-remove-id]");
        if (!removeButton) return;
        handleChannelRemove(removeButton.dataset.channelRemoveId).catch(function (error) {
          refs.channelManagerFeedback.textContent = error?.message || "Nao foi possivel excluir o canal.";
          refs.channelManagerFeedback.className = "feedback error";
        });
      });

      refs.threadBody?.addEventListener("click", function (event) {
        const removeButton = event.target.closest("[data-message-remove-id]");
        if (!removeButton) return;
        handleMessageRemove(removeButton.dataset.messageRemoveId).catch(function (error) {
          refs.composerFeedback.textContent = error?.message || "Nao foi possivel excluir a mensagem.";
          refs.composerFeedback.className = "feedback error";
        });
      });

      refs.newThreadType?.addEventListener("change", function () {
        populateNewThreadOptions();
      });

      refs.newThreadStudent?.addEventListener("change", function () {
        syncNewThreadVisibility();
      });

      refs.searchInput?.addEventListener("input", function () {
        state.searchTerm = normalizeText(refs.searchInput.value);
        renderAll();
      });

      refs.viewToggles.forEach(function (button) {
        button.addEventListener("click", function () {
          setViewMode(button.dataset.view || "board");
          renderAll();
        });
      });

      refs.leftFilters.forEach(function (button) {
        button.addEventListener("click", function () {
          state.leftFilter = button.dataset.leftFilter || "all";
          localStorage.setItem(CHANNEL_FILTER_KEY, state.leftFilter);
          renderAll();
        });
      });

      refs.tabBar.forEach(function (button) {
        button.addEventListener("click", function () {
          state.activeTab = button.dataset.tab || "todas";
          setViewMode("board");
          renderAll();
        });
      });

      refs.filterTurma?.addEventListener("change", function () {
        state.filters.turma = refs.filterTurma.value;
        setViewMode("board");
        renderAll();
      });
      refs.filterSetor?.addEventListener("change", function () {
        state.filters.sector = refs.filterSetor.value;
        setViewMode("board");
        renderAll();
      });
      refs.filterStatus?.addEventListener("change", function () {
        state.filters.status = refs.filterStatus.value;
        setViewMode("board");
        renderAll();
      });
      refs.filterUnread?.addEventListener("change", function () {
        state.filters.unread = refs.filterUnread.value;
        setViewMode("board");
        renderAll();
      });

      refs.sidebarChannelList?.addEventListener("click", function (event) {
        const button = event.target.closest("[data-channel-id]");
        if (!button) return;
        state.selectedChannelId = state.selectedChannelId === button.dataset.channelId ? "" : button.dataset.channelId;
        state.filters.channelId = state.selectedChannelId;
        setViewMode("board");
        renderAll();
      });

      function handleThreadSelection(event) {
        const button = event.target.closest("[data-thread-open-key], [data-thread-key]");
        if (!button) return;
        state.selectedThreadKey = button.dataset.threadOpenKey || button.dataset.threadKey;
        const selectedThread = getSelectedThread();
        if (selectedThread?.lastMessage?.created_at) {
          state.viewState = markThreadRead(state.viewState, session, selectedThread.key, selectedThread.lastMessage.created_at);
          rebuildThreads();
        }
        setViewMode("thread");
        renderAll();
        if (refs.threadBody) refs.threadBody.scrollTop = refs.threadBody.scrollHeight;
      }

      refs.sidebarThreadList?.addEventListener("click", handleThreadSelection);
      refs.boardList?.addEventListener("click", handleThreadSelection);
      refs.threadBackButton?.addEventListener("click", function () {
        setViewMode("board");
        renderAll();
      });

      async function runThreadAction(thread, action) {
        if (!thread) return;

        if (action === "assign") {
          updateThreadState(state, thread.key, { assignedTo: session.name, assignedEmail: session.email });
          rebuildThreads();
          refs.composerFeedback.textContent = "Conversa assumida. Voce ja pode responder em tempo real.";
          refs.composerFeedback.className = "feedback success";
          await refreshAll();
          return;
        }
        if (action === "pin") {
          updateThreadState(state, thread.key, { pinned: !thread.local.pinned });
        }
        if (action === "urgent") {
          updateThreadState(state, thread.key, { urgent: !thread.local.urgent });
        }
        if (action === "resolve") {
          updateThreadState(state, thread.key, { resolved: !thread.local.resolved });
        }
        if (action === "archive") {
          updateThreadState(state, thread.key, { archived: !thread.local.archived });
        }
        if (action === "forward") {
          openNewThreadModal();
          refs.newThreadType.value = "family";
          setSelectValueIfPresent(refs.newThreadChannel, thread.channelId || "");
          setSelectValueIfPresent(refs.newThreadStudent, thread.studentId || "");
          setSelectValueIfPresent(refs.newThreadResponsavel, thread.responsibleId || "");
          setSelectValueIfPresent(refs.newThreadSector, thread.sector || "Secretaria");
          syncNewThreadVisibility();
          refs.newThreadSubject.value = `Encaminhamento: ${thread.subject || thread.channelName}`;
        }
        if (action === "delete-thread") {
          await handleThreadRemove(thread);
          return;
        }

        await refreshAll();
      }

      refs.boardList?.addEventListener("click", function (event) {
        const actionButton = event.target.closest(".message-board-action");
        if (!actionButton) return;
        const card = actionButton.closest("[data-thread-card]");
        const threadKey = card?.dataset.threadCard;
        if (!threadKey) return;
        event.preventDefault();
        event.stopPropagation();
        state.selectedThreadKey = threadKey;
        const thread = getSelectedThread();
        runThreadAction(thread, actionButton.dataset.action).catch(function (error) {
          refs.composerFeedback.textContent = error?.message || "Nao foi possivel atualizar a conversa.";
          refs.composerFeedback.className = "feedback error";
        });
      });

      refs.quickTemplateList?.addEventListener("click", function (event) {
        const button = event.target.closest("[data-template-id]");
        if (!button) return;
        const template = QUICK_TEMPLATES.find(function (item) { return item.id === button.dataset.templateId; });
        if (!template) return;
        refs.composerInput.value = template.text;
        refs.composerInput.focus();
      });

      refs.attachButton?.addEventListener("click", function () {
        refs.attachmentInput.click();
      });

      refs.attachmentInput?.addEventListener("change", async function () {
        try {
          state.pendingAttachments = await buildAttachmentList(Array.from(refs.attachmentInput.files || []));
          refs.composerFeedback.textContent = "";
          refs.composerFeedback.className = "feedback";
          renderAttachmentPreview();
        } catch (error) {
          refs.composerFeedback.textContent = error?.message || "Nao foi possivel preparar os anexos.";
          refs.composerFeedback.className = "feedback error";
        }
      });

      refs.clearAttachmentsButton?.addEventListener("click", function () {
        state.pendingAttachments = [];
        refs.attachmentInput.value = "";
        renderAttachmentPreview();
      });

      refs.internalNoteButton?.addEventListener("click", function () {
        state.internalMode = !state.internalMode;
        refs.internalNoteButton.classList.toggle("active", state.internalMode);
        refs.composerContext.textContent = getComposerContext(getSelectedThread(), session, state.internalMode);
      });

      refs.composerInput?.addEventListener("input", function () {
        refs.typingIndicator.hidden = false;
        clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(function () {
          refs.typingIndicator.hidden = true;
        }, 900);
      });

      refs.saveDraftButton?.addEventListener("click", function () {
        handleComposerSubmit("draft").catch(function (error) {
          refs.composerFeedback.textContent = error?.message || "Nao foi possivel salvar o rascunho.";
          refs.composerFeedback.className = "feedback error";
        });
      });

      refs.composerForm?.addEventListener("submit", function (event) {
        event.preventDefault();
        handleComposerSubmit("send").catch(function (error) {
          refs.composerFeedback.textContent = error?.message || "Nao foi possivel enviar a mensagem.";
          refs.composerFeedback.className = "feedback error";
        });
      });

      refs.threadAlerts?.addEventListener("click", async function (event) {
        const button = event.target.closest(".approval-action");
        if (!button) return;

        const thread = getSelectedThread();
        const pendingMessage = thread?.messages.find(function (message) { return message.workflowStatus === "pending_approval"; });
        if (!thread || !pendingMessage) return;

        const action = button.dataset.action;
        const note = action === "approve" ? "" : window.prompt("Adicione uma observacao para esta acao:") || "";
        const nextStatus = action === "approve" ? "sent" : action === "return" ? "returned" : "rejected";

        await window.AgendaGamaDataStore.save("messages", {
          ...pendingMessage,
          status: nextStatus,
          approved_by: session.name,
          sent_by: nextStatus === "sent" ? session.name : pendingMessage.sent_by
        }, DEFAULT_MESSAGES);

        if (note) {
          await window.AgendaGamaDataStore.save("messages", buildSystemNote(thread, `${action === "return" ? "Mensagem devolvida" : "Mensagem rejeitada"}: ${note}`, session.name, session.email, session.role), DEFAULT_MESSAGES);
        }

        await refreshAll();
      });

      if (!window.__agendaMessageStorageListener) {
        window.addEventListener("storage", function (event) {
          if (!event.key || !event.key.startsWith("agenda-gama-")) return;
          refreshAll();
        });
        window.__agendaMessageStorageListener = true;
      }

      await refreshAll();
      window.setInterval(refreshAll, 4000);
    });
  }

  window.AgendaGamaCommunication = {
    mountCommunication: mountCommunication
  };
})();
