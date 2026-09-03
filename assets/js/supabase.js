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
            detectSessionInUrl: false
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

  function getAuthRedirectParameters() {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const read = function (key) {
      return url.searchParams.get(key) || hashParams.get(key) || "";
    };

    return {
      code: read("code"),
      tokenHash: read("token_hash"),
      type: read("type"),
      accessToken: read("access_token"),
      refreshToken: read("refresh_token"),
      error: read("error_description") || read("error")
    };
  }

  function hasAuthRedirectParameters() {
    const params = getAuthRedirectParameters();
    return Boolean(params && (
      params.code ||
      params.tokenHash ||
      (params.accessToken && params.refreshToken)
    ));
  }

  function clearAuthRedirectParameters() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    [
      "code",
      "token_hash",
      "type",
      "access_token",
      "refresh_token",
      "expires_at",
      "expires_in",
      "token_type",
      "error",
      "error_code",
      "error_description"
    ].forEach(function (key) {
      url.searchParams.delete(key);
    });
    url.hash = "";
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  async function recoverSessionFromUrl() {
    const params = getAuthRedirectParameters();
    const client = await getClient();
    if (!client) return null;
    if (params?.error) {
      throw new Error(params.error.replace(/\+/g, " "));
    }
    if (!hasAuthRedirectParameters()) {
      return await getSession();
    }

    let response;
    if (params.accessToken && params.refreshToken) {
      response = await client.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken
      });
    } else if (params.code) {
      response = await client.auth.exchangeCodeForSession(params.code);
    } else if (params.tokenHash) {
      response = await client.auth.verifyOtp({
        token_hash: params.tokenHash,
        type: params.type || "invite"
      });
    }

    if (response?.error) throw response.error;
    clearAuthRedirectParameters();
    return response?.data?.session || await getSession();
  }

  async function waitForSession(timeoutMs) {
    const client = await getClient();
    if (!client) return null;

    const immediateSession = await getSession();
    if (immediateSession) {
      return immediateSession;
    }

    return await new Promise((resolve) => {
      let subscription = null;
      const timer = setTimeout(function () {
        subscription?.data?.subscription?.unsubscribe();
        resolve(null);
      }, timeoutMs || 4000);

      subscription = client.auth.onAuthStateChange(function (_event, session) {
        if (!session) return;
        clearTimeout(timer);
        subscription?.data?.subscription?.unsubscribe();
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

    const [profileResult, rolesResult] = await Promise.all([
      client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(),
      client
        .from("profile_roles")
        .select("role, role_label")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
    ]);

    if (profileResult.error) throw profileResult.error;
    if (rolesResult.error) throw rolesResult.error;
    if (!profileResult.data) return null;

    return {
      ...profileResult.data,
      roles: rolesResult.data || []
    };
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

  async function setActiveProfileRole(role) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");

    const { data, error } = await client.rpc("set_active_profile_role", {
      target_role: role
    });

    if (error) throw error;
    return data;
  }

  async function completeFirstAccess() {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");

    const { data, error } = await client.rpc("complete_first_access");
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
      response = await client
        .from(tableName)
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();
    } else {
      response = await client.from(tableName).insert(payload).select("*").single();
    }

    if (response.error) throw response.error;
    return response.data;
  }

  async function saveRows(tableName, rows) {
    const client = await getClient();
    if (!client) throw new Error("Supabase nao configurado.");

    const payload = (rows || []).map(cleanRow);
    if (!payload.length) return [];

    const { data, error } = await client
      .from(tableName)
      .upsert(payload, { onConflict: "id" })
      .select("*");

    if (error) throw error;
    return data || [];
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
    hasAuthRedirectParameters,
    recoverSessionFromUrl,
    waitForSession,
    isConfigured,
    signInWithPassword,
    signOut,
    updatePassword,
    getProfile,
    listProfiles,
    updateProfile,
    setActiveProfileRole,
    completeFirstAccess,
    fetchTable,
    fetchById,
    saveRow,
    saveRows,
    deleteRow,
    invokeFunction,
    getSiteUrl
  };
})();
