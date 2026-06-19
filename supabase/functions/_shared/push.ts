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

export async function sendPushToUserIds(
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
        TTL: 60,
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
