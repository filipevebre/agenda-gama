(function () {
  let statePromise = null;

  function getConfig() {
    const config = Object.assign(
      {
        supabaseUrl: "",
        supabaseAnonKey: "",
        functionsBaseUrl: "",
        siteUrl: typeof window !== "undefined" ? window.location.origin : ""
      },
      window.AgendaGamaConfig || {}
    );

    return {
      ...config,
      enabled: Boolean(config.supabaseUrl && config.supabaseAnonKey),
      functionsBaseUrl: config.functionsBaseUrl || (config.supabaseUrl ? `${config.supabaseUrl}/functions/v1` : "")
    };
  }

  async function getState() {
    if (!statePromise) {
      statePromise = (async function () {
        const config = getConfig();
        if (!config.enabled) {
          return { enabled: false, config, client: null };
        }

        const supabaseModule = await import("https://esm.sh/@supabase/supabase-js@2");
        const client = supabaseModule.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });

        return { enabled: true, config, client };
      })();
    }

    return statePromise;
  }

  function cleanRow(row) {
    const nextRow = { ...row };
    delete nextRow.created_at;
    delete nextRow.updated_at;

    Object.keys(nextRow).forEach((key) => {
      if (typeof nextRow[key] === "undefined") {
        delete nextRow[key];
      }
    });

    return nextRow;
  }

  async function getClient() {
    const state = await getState();
    return state.client;
  }

  async function isConfigured() {
    const state = await getState();
    return state.enabled;
  }

  async function getSession() {
    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function waitForSession(timeoutMs) {
    const client = await getClient();
    if (!client) return null;

    const immediateSession = await getSession();
    if (immediateSession) {
      return immediateSession;
    }

    return await new Promise((resolve) => {
      const timer = setTimeout(function () {
        subscription.data.subscription.unsubscribe();
        resolve(null);
      }, timeoutMs || 4000);

      const subscription = client.auth.onAuthStateChange(function (_event, session) {
        if (!session) return;
        clearTimeout(timer);
        subscription.data.subscription.unsubscribe();
        resolve(session);
      });
    });
  }

  async function signInWithPassword(email, password) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");
    return await client.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    const client = await getClient();
    if (!client) return;
    await client.auth.signOut();
  }

  async function updatePassword(password, data) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");
    return await client.auth.updateUser(data ? { password, data } : { password });
  }

  async function getProfile(userId) {
    const client = await getClient();
    if (!client || !userId) return null;

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function listProfiles() {
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function updateProfile(userId, payload) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");

    const { data, error } = await client
      .from("profiles")
      .update(cleanRow(payload))
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function fetchTable(tableName) {
    const client = await getClient();
    if (!client) return [];

    const { data, error } = await client
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function fetchById(tableName, id) {
    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client
      .from(tableName)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function saveRow(tableName, row) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");

    const payload = cleanRow(row);
    let response;

    if (payload.id) {
      const id = payload.id;
      delete payload.id;
      response = await client.from(tableName).update(payload).eq("id", id).select("*").single();
    } else {
      response = await client.from(tableName).insert(payload).select("*").single();
    }

    if (response.error) throw response.error;
    return response.data;
  }

  async function deleteRow(tableName, id) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");

    const { error } = await client.from(tableName).delete().eq("id", id);
    if (error) throw error;
  }

  async function invokeFunction(name, body) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");

    const { data, error } = await client.functions.invoke(name, { body });
    if (error) {
      if (error.context && typeof error.context.json === "function") {
        try {
          const payload = await error.context.json();
          throw new Error(payload?.error || payload?.message || error.message || "A Edge Function retornou um erro.");
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message) {
            throw parseError;
          }
        }
      }

      if (error.context && typeof error.context.text === "function") {
        try {
          const message = await error.context.text();
          throw new Error(message || error.message || "A Edge Function retornou um erro.");
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message) {
            throw parseError;
          }
        }
      }

      throw new Error(error.message || "A Edge Function retornou um erro.");
    }
    return data;
  }

  async function getSiteUrl() {
    const state = await getState();
    return state.config.siteUrl || (typeof window !== "undefined" ? window.location.origin : "");
  }

  window.AgendaGamaSupabase = {
    getConfig,
    getClient,
    getSession,
    waitForSession,
    isConfigured,
    signInWithPassword,
    signOut,
    updatePassword,
    getProfile,
    listProfiles,
    updateProfile,
    fetchTable,
    fetchById,
    saveRow,
    deleteRow,
    invokeFunction,
    getSiteUrl
  };
})();
