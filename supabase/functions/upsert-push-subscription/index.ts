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
    const { subscription, deviceLabel, userAgent } = await req.json()
    const endpoint = String(subscription?.endpoint || "").trim()
    const p256dh = String(subscription?.keys?.p256dh || "").trim()
    const auth = String(subscription?.keys?.auth || "").trim()

    if (!endpoint || !p256dh || !auth) {
      return new Response(JSON.stringify({ error: "Assinatura de push invalida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data, error } = await adminClient
      .from("push_subscriptions")
      .upsert({
        auth_user_id: user.id,
        endpoint,
        subscription,
        device_label: String(deviceLabel || "").trim(),
        user_agent: String(userAgent || "").trim(),
        last_seen_at: new Date().toISOString()
      }, { onConflict: "endpoint" })
      .select("id, endpoint, auth_user_id")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return new Response(JSON.stringify({
      subscription: data
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
