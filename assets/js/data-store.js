(function () {
  const TABLE_MAP = {
    turmas: "turmas",
    disciplinas: "disciplinas",
    equipe: "equipe",
    professores: "professores",
    alunos: "alunos",
    responsaveis: "responsaveis",
    diario: "student_diary_entries",
    channels: "communication_channels",
    messages: "communication_messages"
  };
  const LOCAL_ONLY_KEYS = new Set();
  const MIGRATABLE_KEYS = new Set(["diario"]);

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
      await window.AgendaGamaSupabase.saveRow(getTableName(key), item);
    }

    localStorage.setItem(getMigrationFlagKey(key), "done");
  }

  async function list(key, seedData) {
    if (!LOCAL_ONLY_KEYS.has(key) && await useRemote()) {
      await migrateLocalToRemoteIfNeeded(key, seedData);
      return await window.AgendaGamaSupabase.fetchTable(getTableName(key));
    }

    return readLocal(key, seedData);
  }

  async function getById(key, id, seedData) {
    if (!id) return null;

    if (!LOCAL_ONLY_KEYS.has(key) && await useRemote()) {
      return await window.AgendaGamaSupabase.fetchById(getTableName(key), id);
    }

    return readLocal(key, seedData).find((item) => item.id === id) || null;
  }

  async function save(key, item, seedData) {
    if (!LOCAL_ONLY_KEYS.has(key) && await useRemote()) {
      return await window.AgendaGamaSupabase.saveRow(getTableName(key), item);
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
      await window.AgendaGamaSupabase.deleteRow(getTableName(key), id);
      return;
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
