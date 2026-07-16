(function () {
  const TABLE_MAP = {
    turmas: "turmas",
    disciplinas: "disciplinas",
    equipe: "equipe",
    professores: "professores",
    alunos: "alunos",
    responsaveis: "responsaveis",
    notices: "school_notices",
    diario: "student_diary_entries",
    channels: "communication_channels",
    messages: "communication_messages",
    forms: "school_forms",
    formResponses: "school_form_responses",
    activities: "school_activities",
    activityCompletions: "school_activity_completions",
    menus: "school_menus"
  };
  const LOCAL_ONLY_KEYS = new Set();
  const MIGRATABLE_KEYS = new Set(["diario", "notices"]);
  const REMOTE_REQUIRED_KEYS = new Set(["notices", "forms", "formResponses", "activities", "activityCompletions", "menus"]);

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return [value];
  }

  function mapDiaryFromRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      batchId: item.batch_id || item.batchId || null,
      studentId: item.student_id || item.studentId || null,
      studentName: item.student_name || item.studentName || "",
      turma: item.turma || "",
      turno: item.turno || "",
      category: item.category || "rotina",
      title: item.title || "",
      body: item.body || "",
      photos: normalizeArray(item.photos).filter(Boolean),
      authorName: item.author_name || item.authorName || "",
      authorEmail: item.author_email || item.authorEmail || "",
      authorRole: item.author_role || item.authorRole || "",
      targetMode: item.target_mode || item.targetMode || "students",
      recipientCount: Number(item.recipient_count || item.recipientCount || 1),
      targetTurmas: normalizeArray(item.target_turmas || item.targetTurmas).filter(Boolean),
      entryDate: item.entry_date || item.entryDate || "",
      createdAt: item.created_at || item.createdAt || null,
      updatedAt: item.updated_at || item.updatedAt || null
    };
  }

  function mapDiaryToRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      batch_id: item.batchId || item.batch_id || null,
      student_id: item.studentId || item.student_id || null,
      student_name: item.studentName || item.student_name || "",
      turma: item.turma || "",
      turno: item.turno || "",
      category: item.category || "rotina",
      title: item.title || "",
      body: item.body || "",
      photos: normalizeArray(item.photos).filter(Boolean),
      author_name: item.authorName || item.author_name || "",
      author_email: item.authorEmail || item.author_email || "",
      author_role: item.authorRole || item.author_role || "",
      target_mode: item.targetMode || item.target_mode || "students",
      recipient_count: Number(item.recipientCount || item.recipient_count || 1),
      target_turmas: normalizeArray(item.targetTurmas || item.target_turmas).filter(Boolean),
      entry_date: item.entryDate || item.entry_date || null
    };
  }

  function mapNoticeFromRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      title: item.title || "",
      summary: item.summary || "",
      body: item.body || "",
      audience: item.audience || "all",
      targetTurmas: normalizeArray(item.target_turmas || item.targetTurmas).filter(Boolean),
      archiveDate: item.archive_date || item.archiveDate || "",
      pinned: Boolean(item.pinned),
      urgent: Boolean(item.urgent),
      authorName: item.author_name || item.authorName || "",
      authorRole: item.author_role || item.authorRole || "",
      createdAt: item.created_at || item.createdAt || null,
      updatedAt: item.updated_at || item.updatedAt || null
    };
  }

  function mapNoticeToRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      title: item.title || "",
      summary: item.summary || "",
      body: item.body || "",
      audience: item.audience || "all",
      target_turmas: normalizeArray(item.targetTurmas || item.target_turmas).filter(Boolean),
      archive_date: item.archiveDate || item.archive_date || null,
      pinned: Boolean(item.pinned),
      urgent: Boolean(item.urgent),
      author_name: item.authorName || item.author_name || "",
      author_role: item.authorRole || item.author_role || ""
    };
  }

  function mapFormFromRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      title: item.title || "",
      description: item.description || "",
      category: item.category || "geral",
      status: item.status || "draft",
      targetTurmas: normalizeArray(item.target_turmas || item.targetTurmas).filter(Boolean),
      questions: normalizeArray(item.questions).filter(Boolean),
      closesAt: item.closes_at || item.closesAt || "",
      authorUserId: item.author_user_id || item.authorUserId || null,
      authorName: item.author_name || item.authorName || "",
      authorEmail: item.author_email || item.authorEmail || "",
      createdAt: item.created_at || item.createdAt || null,
      updatedAt: item.updated_at || item.updatedAt || null
    };
  }

  function mapFormToRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      title: item.title || "",
      description: item.description || "",
      category: item.category || "geral",
      status: item.status || "draft",
      target_turmas: normalizeArray(item.targetTurmas || item.target_turmas).filter(Boolean),
      questions: normalizeArray(item.questions).filter(Boolean),
      closes_at: item.closesAt || item.closes_at || null,
      author_user_id: item.authorUserId || item.author_user_id || null,
      author_name: item.authorName || item.author_name || "",
      author_email: item.authorEmail || item.author_email || ""
    };
  }

  function mapFormResponseFromRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      formId: item.form_id || item.formId || null,
      authUserId: item.auth_user_id || item.authUserId || null,
      responsibleName: item.responsible_name || item.responsibleName || "",
      responsibleEmail: item.responsible_email || item.responsibleEmail || "",
      studentId: item.student_id || item.studentId || null,
      studentName: item.student_name || item.studentName || "",
      turma: item.turma || "",
      answers: item.answers && typeof item.answers === "object" ? item.answers : {},
      createdAt: item.created_at || item.createdAt || null,
      submittedAt: item.submitted_at || item.submittedAt || null,
      updatedAt: item.updated_at || item.updatedAt || null
    };
  }

  function mapFormResponseToRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      form_id: item.formId || item.form_id || null,
      auth_user_id: item.authUserId || item.auth_user_id || null,
      responsible_name: item.responsibleName || item.responsible_name || "",
      responsible_email: item.responsibleEmail || item.responsible_email || "",
      student_id: item.studentId || item.student_id || null,
      student_name: item.studentName || item.student_name || "",
      turma: item.turma || "",
      answers: item.answers && typeof item.answers === "object" ? item.answers : {},
      submitted_at: item.submittedAt || item.submitted_at || new Date().toISOString()
    };
  }

  function mapActivityFromRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      title: item.title || "",
      subject: item.subject || "",
      description: item.description || "",
      status: item.status || "draft",
      targetTurmas: normalizeArray(item.target_turmas || item.targetTurmas).filter(Boolean),
      attachments: normalizeArray(item.attachments).filter(Boolean),
      dueAt: item.due_at || item.dueAt || "",
      authorUserId: item.author_user_id || item.authorUserId || null,
      authorName: item.author_name || item.authorName || "",
      authorEmail: item.author_email || item.authorEmail || "",
      createdAt: item.created_at || item.createdAt || null,
      updatedAt: item.updated_at || item.updatedAt || null
    };
  }

  function mapActivityToRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      title: item.title || "",
      subject: item.subject || "",
      description: item.description || "",
      status: item.status || "draft",
      target_turmas: normalizeArray(item.targetTurmas || item.target_turmas).filter(Boolean),
      attachments: normalizeArray(item.attachments).filter(Boolean),
      due_at: item.dueAt || item.due_at || null,
      author_user_id: item.authorUserId || item.author_user_id || null,
      author_name: item.authorName || item.author_name || "",
      author_email: item.authorEmail || item.author_email || ""
    };
  }

  function mapActivityCompletionFromRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      activityId: item.activity_id || item.activityId || null,
      authUserId: item.auth_user_id || item.authUserId || null,
      studentId: item.student_id || item.studentId || null,
      studentName: item.student_name || item.studentName || "",
      turma: item.turma || "",
      responsibleName: item.responsible_name || item.responsibleName || "",
      responsibleEmail: item.responsible_email || item.responsibleEmail || "",
      completedAt: item.completed_at || item.completedAt || null,
      createdAt: item.created_at || item.createdAt || null,
      updatedAt: item.updated_at || item.updatedAt || null
    };
  }

  function mapActivityCompletionToRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      activity_id: item.activityId || item.activity_id || null,
      auth_user_id: item.authUserId || item.auth_user_id || null,
      student_id: item.studentId || item.student_id || null,
      student_name: item.studentName || item.student_name || "",
      turma: item.turma || "",
      responsible_name: item.responsibleName || item.responsible_name || "",
      responsible_email: item.responsibleEmail || item.responsible_email || "",
      completed_at: item.completedAt || item.completed_at || new Date().toISOString()
    };
  }

  function mapMenuFromRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      menuDate: item.menu_date || item.menuDate || "",
      title: item.title || "Cardápio do dia",
      status: item.status || "draft",
      targetTurmas: normalizeArray(item.target_turmas || item.targetTurmas).filter(Boolean),
      meals: normalizeArray(item.meals).filter(Boolean),
      notes: item.notes || "",
      allergens: item.allergens || "",
      authorUserId: item.author_user_id || item.authorUserId || null,
      authorName: item.author_name || item.authorName || "",
      authorEmail: item.author_email || item.authorEmail || "",
      createdAt: item.created_at || item.createdAt || null,
      updatedAt: item.updated_at || item.updatedAt || null
    };
  }

  function mapMenuToRemote(item) {
    if (!item || typeof item !== "object") return item;

    return {
      id: item.id || null,
      menu_date: item.menuDate || item.menu_date || null,
      title: item.title || "Cardápio do dia",
      status: item.status || "draft",
      target_turmas: normalizeArray(item.targetTurmas || item.target_turmas).filter(Boolean),
      meals: normalizeArray(item.meals).filter(Boolean),
      notes: item.notes || "",
      allergens: item.allergens || "",
      author_user_id: item.authorUserId || item.author_user_id || null,
      author_name: item.authorName || item.author_name || "",
      author_email: item.authorEmail || item.author_email || ""
    };
  }

  function mapFromRemote(key, item) {
    if (key === "diario") {
      return mapDiaryFromRemote(item);
    }

    if (key === "notices") {
      return mapNoticeFromRemote(item);
    }

    if (key === "forms") {
      return mapFormFromRemote(item);
    }

    if (key === "formResponses") {
      return mapFormResponseFromRemote(item);
    }

    if (key === "activities") {
      return mapActivityFromRemote(item);
    }

    if (key === "activityCompletions") {
      return mapActivityCompletionFromRemote(item);
    }

    if (key === "menus") {
      return mapMenuFromRemote(item);
    }

    return item;
  }

  function mapToRemote(key, item) {
    if (key === "diario") {
      return mapDiaryToRemote(item);
    }

    if (key === "notices") {
      return mapNoticeToRemote(item);
    }

    if (key === "forms") {
      return mapFormToRemote(item);
    }

    if (key === "formResponses") {
      return mapFormResponseToRemote(item);
    }

    if (key === "activities") {
      return mapActivityToRemote(item);
    }

    if (key === "activityCompletions") {
      return mapActivityCompletionToRemote(item);
    }

    if (key === "menus") {
      return mapMenuToRemote(item);
    }

    return item;
  }

  function getStorageKey(key) {
    return `agenda-gama-${key}`;
  }

  function getMigrationFlagKey(key) {
    return `agenda-gama-remote-migrated-${key}`;
  }

  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeLocalItems(items) {
    return (items || []).map((item) => ({
      ...item,
      id: item.id || generateId()
    }));
  }

  function readLocal(key, seedData) {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) {
      const seededItems = normalizeLocalItems(seedData || []);
      localStorage.setItem(getStorageKey(key), JSON.stringify(seededItems));
      return seededItems;
    }

    try {
      const parsedItems = normalizeLocalItems(JSON.parse(raw));
      localStorage.setItem(getStorageKey(key), JSON.stringify(parsedItems));
      return parsedItems;
    } catch (error) {
      const fallbackItems = normalizeLocalItems(seedData || []);
      localStorage.setItem(getStorageKey(key), JSON.stringify(fallbackItems));
      return fallbackItems;
    }
  }

  function writeLocal(key, items) {
    localStorage.setItem(getStorageKey(key), JSON.stringify(normalizeLocalItems(items)));
  }

  function getTableName(key) {
    return TABLE_MAP[key] || key;
  }

  async function useRemote() {
    if (!window.AgendaGamaSupabase) return false;
    return await window.AgendaGamaSupabase.isConfigured();
  }

  async function migrateLocalToRemoteIfNeeded(key, seedData) {
    if (!MIGRATABLE_KEYS.has(key)) return;
    if (localStorage.getItem(getMigrationFlagKey(key)) === "done") return;

    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) {
      localStorage.setItem(getMigrationFlagKey(key), "done");
      return;
    }

    let localItems = [];
    try {
      localItems = normalizeLocalItems(JSON.parse(raw));
    } catch (error) {
      localStorage.setItem(getMigrationFlagKey(key), "done");
      return;
    }

    const seedIds = new Set(normalizeLocalItems(seedData || []).map((item) => item.id));
    const migratableItems = localItems.filter((item) => !seedIds.has(item.id));
    if (!migratableItems.length) {
      localStorage.setItem(getMigrationFlagKey(key), "done");
      return;
    }

    const remoteItems = await window.AgendaGamaSupabase.fetchTable(getTableName(key));
    const remoteIds = new Set((remoteItems || []).map((item) => item.id));

    for (const item of migratableItems) {
      if (remoteIds.has(item.id)) continue;
      await window.AgendaGamaSupabase.saveRow(getTableName(key), mapToRemote(key, item));
    }

    localStorage.setItem(getMigrationFlagKey(key), "done");
  }

  async function list(key, seedData) {
    if (!LOCAL_ONLY_KEYS.has(key) && await useRemote()) {
      try {
        await migrateLocalToRemoteIfNeeded(key, seedData);
        return (await window.AgendaGamaSupabase.fetchTable(getTableName(key))).map(function (item) {
          return mapFromRemote(key, item);
        });
      } catch (error) {
        if (REMOTE_REQUIRED_KEYS.has(key)) {
          throw error;
        }
        if (MIGRATABLE_KEYS.has(key)) {
          console.warn(`[Agenda Gama] Fallback local ativado para ${key}.`, error);
          return readLocal(key, seedData);
        }
        throw error;
      }
    }

    return readLocal(key, seedData);
  }

  async function getById(key, id, seedData) {
    if (!id) return null;

    if (!LOCAL_ONLY_KEYS.has(key) && await useRemote()) {
      try {
        return mapFromRemote(key, await window.AgendaGamaSupabase.fetchById(getTableName(key), id));
      } catch (error) {
        if (REMOTE_REQUIRED_KEYS.has(key)) {
          throw error;
        }
        if (MIGRATABLE_KEYS.has(key)) {
          console.warn(`[Agenda Gama] Fallback local ativado para ${key}.`, error);
          return readLocal(key, seedData).find((item) => item.id === id) || null;
        }
        throw error;
      }
    }

    return readLocal(key, seedData).find((item) => item.id === id) || null;
  }

  async function save(key, item, seedData) {
    if (!LOCAL_ONLY_KEYS.has(key) && await useRemote()) {
      try {
        return mapFromRemote(key, await window.AgendaGamaSupabase.saveRow(getTableName(key), mapToRemote(key, item)));
      } catch (error) {
        if (REMOTE_REQUIRED_KEYS.has(key)) {
          throw error;
        }
        if (!MIGRATABLE_KEYS.has(key)) {
          throw error;
        }
        console.warn(`[Agenda Gama] Salvando ${key} localmente por fallback.`, error);
      }
    }

    const items = readLocal(key, seedData);
    const nextItem = { ...item, id: item.id || generateId() };
    const itemIndex = items.findIndex((currentItem) => currentItem.id === nextItem.id);

    if (itemIndex >= 0) {
      items[itemIndex] = nextItem;
    } else {
      items.unshift(nextItem);
    }

    writeLocal(key, items);
    return nextItem;
  }

  async function remove(key, id, seedData) {
    if (!LOCAL_ONLY_KEYS.has(key) && await useRemote()) {
      try {
        await window.AgendaGamaSupabase.deleteRow(getTableName(key), id);
        return;
      } catch (error) {
        if (REMOTE_REQUIRED_KEYS.has(key)) {
          throw error;
        }
        if (!MIGRATABLE_KEYS.has(key)) {
          throw error;
        }
        console.warn(`[Agenda Gama] Removendo ${key} localmente por fallback.`, error);
      }
    }

    const items = readLocal(key, seedData).filter((item) => item.id !== id);
    writeLocal(key, items);
  }

  window.AgendaGamaDataStore = {
    list,
    getById,
    save,
    remove
  };
})();
