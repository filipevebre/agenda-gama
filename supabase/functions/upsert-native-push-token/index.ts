import { corsHeaders } from "../_shared/cors.ts"
import {
  createAdminClient,
  createUserClient,
  requireAuthenticatedUser
} from "../_shared/push.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const userClient = createUserClient(authHeader)
    const adminClient = createAdminClient()
    const user = await requireAuthenticatedUser(userClient)
    const { token, platform, deviceLabel, userAgent } = await req.json()
    const normalizedToken = String(token || "").trim()
    const normalizedPlatform = String(platform || "android").trim().toLowerCase()

    if (!normalizedToken || normalizedToken.length < 20) {
      return new Response(JSON.stringify({ error: "Token nativo invalido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (normalizedPlatform !== "android" && normalizedPlatform !== "ios") {
      return new Response(JSON.stringify({ error: "Plataforma nativa invalida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data, error } = await adminClient
      .from("native_push_tokens")
      .upsert({
        auth_user_id: user.id,
        token: normalizedToken,
        platform: normalizedPlatform,
        device_label: String(deviceLabel || "").trim(),
        user_agent: String(userAgent || "").trim(),
        last_seen_at: new Date().toISOString()
      }, { onConflict: "token" })
      .select("id, auth_user_id, platform, last_seen_at")
      .single()

    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ device: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error) {
    console.error("[upsert-native-push-token] failed", error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
