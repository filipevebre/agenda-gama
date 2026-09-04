import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";

const source = readFileSync(resolve("assets/js/supabase.js"), "utf8").replace(
  'const supabaseModule = await import("https://esm.sh/@supabase/supabase-js@2");',
  "const supabaseModule = window.__supabaseModule;"
);
assert.doesNotMatch(source, /await import\(/);

const stored = new Map();
let currentSession = null;
let setSessionCalls = 0;
let updateUserCalls = 0;
let failNextUpdate = false;
const makeSession = (tokens) => ({
  ...tokens,
  user: { id: "user-1", email: "responsavel@example.com" }
});

const client = {
  auth: {
    async getSession() {
      return { data: { session: currentSession }, error: null };
    },
    async setSession(tokens) {
      setSessionCalls += 1;
      currentSession = makeSession(tokens);
      return { data: { session: currentSession }, error: null };
    },
    async updateUser() {
      updateUserCalls += 1;
      if (failNextUpdate) {
        failNextUpdate = false;
        currentSession = null;
        return { data: { user: null }, error: new Error("Auth session missing!") };
      }
      return currentSession
        ? { data: { user: currentSession.user }, error: null }
        : { data: { user: null }, error: new Error("Auth session missing!") };
    },
    async signOut() {
      currentSession = null;
    }
  }
};

const location = {
  href: "https://agenda-gama.vercel.app/app/criar-senha.html#access_token=invite-access&refresh_token=invite-refresh&type=invite"
};
const window = {
  AgendaGamaConfig: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key"
  },
  __supabaseModule: { createClient: () => client },
  location,
  history: {
    replaceState(_state, _title, nextUrl) {
      location.href = new URL(nextUrl, location.href).toString();
    }
  },
  sessionStorage: {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key)
  }
};

new Script(source, { filename: "assets/js/supabase.js" }).runInNewContext({
  window,
  URL,
  URLSearchParams,
  console,
  setTimeout,
  clearTimeout
});

const inviteSession = await window.AgendaGamaSupabase.recoverSessionFromUrl();
assert.equal(inviteSession.user.id, "user-1");
assert.equal(setSessionCalls, 1);
assert.ok(stored.has("agenda-gama-first-access-session"));
assert.equal(new URL(location.href).hash, "");

currentSession = null;
const passwordResult = await window.AgendaGamaSupabase.updatePassword("nova-senha", {
  first_access_pending: false
});
assert.equal(passwordResult.error, null);
assert.equal(setSessionCalls, 2);
assert.equal(updateUserCalls, 1);

failNextUpdate = true;
const retriedPasswordResult = await window.AgendaGamaSupabase.updatePassword("outra-senha", {
  first_access_pending: false
});
assert.equal(retriedPasswordResult.error, null);
assert.equal(setSessionCalls, 3);
assert.equal(updateUserCalls, 3);

await window.AgendaGamaSupabase.signOut();
assert.equal(stored.has("agenda-gama-first-access-session"), false);

console.log("first access session recovery: ok");
