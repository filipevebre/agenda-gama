import { createClient } from "npm:@supabase/supabase-js@2"
import webpush from "npm:web-push@3.6.7"

const MESSAGE_PREFIX = "AGAMA_MESSAGE::"

export type PushPayload = {
  id?: string
  kind?: string
  tag?: string
  title: string
  body: string
  href: string
}

type AuthenticatedUser = {
  id: string
  email?: string
}

type PushSubscriptionRow = {
  id: string
  auth_user_id: string
  endpoint: string
  subscription: Record<string, unknown>
}

type NativePushTokenRow = {
  id: string
  auth_user_id: string
  token: string
  platform: "android" | "ios"
}

type FirebaseServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
  token_uri?: string
}

let firebaseAccessTokenCache: { token: string; expiresAt: number } | null = null

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase()
}

export function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function turmaMatches(left: string, right: string) {
  return normalizeText(left)
    .replace(/\u00aa/g, "a")
    .replace(/\u00ba/g, "o") === normalizeText(right)
      .replace(/\u00aa/g, "a")
      .replace(/\u00ba/g, "o")
}

export function previewText(value: string, maxLength = 120) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

export function parseEnvelopeContent(content: string) {
  const raw = String(content || "")
  if (!raw.startsWith(MESSAGE_PREFIX)) {
    return {
      text: raw,
      internalOnly: false,
      attachments: [],
      thread: null,
      placeholder: false
    }
  }

  try {
    return JSON.parse(raw.slice(MESSAGE_PREFIX.length))
  } catch (_error) {
    return {
      text: raw,
      internalOnly: false,
      attachments: [],
      thread: null,
      placeholder: false
    }
  }
}

export function createUserClient(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export async function requireAuthenticatedUser(userClient: ReturnType<typeof createUserClient>): Promise<AuthenticatedUser> {
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) {
    throw new Error("Not authenticated.")
  }

  return {
    id: data.user.id,
    email: data.user.email || ""
  }
}

export async function getCallerProfile(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, email, full_name, role, role_label, can_approve")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Caller profile not found.")
  }

  return data
}

export function getVapidPublicKey() {
  return String(Deno.env.get("WEB_PUSH_PUBLIC_KEY") || "").trim()
}

function configureWebPush() {
  const publicKey = getVapidPublicKey()
  const privateKey = String(Deno.env.get("WEB_PUSH_PRIVATE_KEY") || "").trim()
  const subject = String(Deno.env.get("WEB_PUSH_SUBJECT") || "mailto:suporte@agenda-gama.app").trim()

  if (!publicKey || !privateKey) {
    throw new Error("Configure WEB_PUSH_PUBLIC_KEY e WEB_PUSH_PRIVATE_KEY nas secrets do Supabase.")
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export function buildAppUrl(pathOrHref: string) {
  const baseUrl = String(
    Deno.env.get("SITE_URL")
      || Deno.env.get("APP_ORIGIN")
      || Deno.env.get("PUBLIC_SITE_URL")
      || ""
  ).trim()

  if (!baseUrl) {
    return String(pathOrHref || "/app/dashboard.html")
  }

  return new URL(String(pathOrHref || "/app/dashboard.html"), `${baseUrl.replace(/\/$/, "")}/`).toString()
}

export function buildNativeAppPath(pathOrHref: string) {
  try {
    const target = new URL(buildAppUrl(pathOrHref), "https://agenda-gama.vercel.app")
    if (!target.pathname.startsWith("/app/")) {
      return "/app/dashboard.html"
    }
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return "/app/dashboard.html"
  }
}

async function sendWebPushToUserIds(
  adminClient: ReturnType<typeof createAdminClient>,
  userIds: string[],
  payload: PushPayload
) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))]
  if (!uniqueUserIds.length) {
    return { targetedUsers: 0, subscriptions: 0, sent: 0, removed: 0, errors: [] as string[] }
  }

  configureWebPush()

  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("id, auth_user_id, endpoint, subscription")
    .in("auth_user_id", uniqueUserIds)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (subscriptions || []) as PushSubscriptionRow[]
  const invalidIds: string[] = []
  const errors: string[] = []
  let sentCount = 0

  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription as never, JSON.stringify({
        id: payload.id || "",
        kind: payload.kind || "",
        tag: payload.tag || payload.id || `agenda-gama-${Date.now()}`,
        title: payload.title,
        body: payload.body,
        href: buildAppUrl(payload.href)
      }), {
        TTL: 60 * 60 * 24,
        urgency: "high"
      })
      sentCount += 1
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number; status?: number })?.statusCode || (error as { status?: number })?.status || 0)
      if (statusCode === 404 || statusCode === 410) {
        invalidIds.push(row.id)
        continue
      }

      const message = error instanceof Error ? error.message : String(error || "Erro desconhecido ao enviar push.")
      errors.push(message)
    }
  }

  if (invalidIds.length) {
    await adminClient
      .from("push_subscriptions")
      .delete()
      .in("id", invalidIds)
  }

  return {
    targetedUsers: uniqueUserIds.length,
    subscriptions: rows.length,
    sent: sentCount,
    removed: invalidIds.length,
    errors
  }
}

function encodeBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function decodePemPrivateKey(value: string) {
  const normalized = String(value || "").replace(/\\n/g, "\n")
  const base64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "")

  if (!base64) throw new Error("A chave privada do Firebase esta vazia.")
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function getFirebaseServiceAccount(): FirebaseServiceAccount {
  const rawValue = String(
    Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
      || Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
      || ""
  ).trim()

  if (!rawValue) {
    throw new Error("Configure FIREBASE_SERVICE_ACCOUNT_JSON nas secrets do Supabase.")
  }

  let parsed: FirebaseServiceAccount
  try {
    const json = rawValue.startsWith("{") ? rawValue : atob(rawValue)
    parsed = JSON.parse(json) as FirebaseServiceAccount
  } catch (_error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON nao contem um JSON valido.")
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("A conta de servico do Firebase esta incompleta.")
  }

  return parsed
}

async function getFirebaseAccessToken() {
  if (firebaseAccessTokenCache && firebaseAccessTokenCache.expiresAt > Date.now() + 60_000) {
    return firebaseAccessTokenCache.token
  }

  const serviceAccount = getFirebaseServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = encodeBase64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }))
  const unsignedToken = `${header}.${claims}`
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodePemPrivateKey(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken)
  )
  const assertion = `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`

  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  })
  const result = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || `O Firebase recusou a autenticacao (${response.status}).`)
  }

  firebaseAccessTokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max(300, Number(result.expires_in || 3600)) * 1000
  }
  return result.access_token
}

async function sendNativePushToUserIds(
  adminClient: ReturnType<typeof createAdminClient>,
  userIds: string[],
  payload: PushPayload
) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))]
  if (!uniqueUserIds.length) {
    return { targetedUsers: 0, devices: 0, sent: 0, removed: 0, errors: [] as string[] }
  }

  const { data, error } = await adminClient
    .from("native_push_tokens")
    .select("id, auth_user_id, token, platform")
    .in("auth_user_id", uniqueUserIds)

  if (error) throw new Error(error.message)

  const rows = (data || []) as NativePushTokenRow[]
  if (!rows.length) {
    return { targetedUsers: uniqueUserIds.length, devices: 0, sent: 0, removed: 0, errors: [] as string[] }
  }

  const serviceAccount = getFirebaseServiceAccount()
  const accessToken = await getFirebaseAccessToken()
  const invalidIds: string[] = []
  const errors: string[] = []
  let sentCount = 0

  for (const row of rows) {
    if (row.platform !== "android") continue

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: {
              title: payload.title,
              body: payload.body
            },
            data: {
              id: String(payload.id || ""),
              kind: String(payload.kind || ""),
              tag: String(payload.tag || payload.id || `agenda-gama-${Date.now()}`),
              href: buildNativeAppPath(payload.href)
            },
            android: {
              priority: "HIGH",
              notification: {
                channel_id: "agenda_gama_alerts",
                sound: "default",
                tag: String(payload.tag || payload.id || "agenda-gama")
              }
            }
          }
        })
      }
    )

    if (response.ok) {
      sentCount += 1
      continue
    }

    const detail = await response.text()
    if (/UNREGISTERED|registration-token-not-registered/i.test(detail)) {
      invalidIds.push(row.id)
      continue
    }
    errors.push(`FCM ${response.status}: ${previewText(detail, 180)}`)
  }

  if (invalidIds.length) {
    await adminClient.from("native_push_tokens").delete().in("id", invalidIds)
  }

  return {
    targetedUsers: uniqueUserIds.length,
    devices: rows.length,
    sent: sentCount,
    removed: invalidIds.length,
    errors
  }
}

export async function sendPushToUserIds(
  adminClient: ReturnType<typeof createAdminClient>,
  userIds: string[],
  payload: PushPayload
) {
  const [webResult, nativeResult] = await Promise.allSettled([
    sendWebPushToUserIds(adminClient, userIds, payload),
    sendNativePushToUserIds(adminClient, userIds, payload)
  ])

  const web = webResult.status === "fulfilled"
    ? webResult.value
    : { targetedUsers: userIds.length, subscriptions: 0, sent: 0, removed: 0, errors: [String(webResult.reason?.message || webResult.reason)] }
  const native = nativeResult.status === "fulfilled"
    ? nativeResult.value
    : { targetedUsers: userIds.length, devices: 0, sent: 0, removed: 0, errors: [String(nativeResult.reason?.message || nativeResult.reason)] }

  return {
    targetedUsers: Math.max(web.targetedUsers, native.targetedUsers),
    subscriptions: web.subscriptions,
    nativeDevices: native.devices,
    sent: web.sent + native.sent,
    removed: web.removed + native.removed,
    errors: [...web.errors, ...native.errors],
    web,
    native
  }
}
