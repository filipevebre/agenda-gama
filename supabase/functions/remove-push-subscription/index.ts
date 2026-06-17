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
    const { endpoint } = await req.json().catch(() => ({ endpoint: "" }))
    const normalizedEndpoint = String(endpoint || "").trim()

    let query = adminClient
      .from("push_subscriptions")
      .delete()
      .eq("auth_user_id", user.id)

    if (normalizedEndpoint) {
      query = query.eq("endpoint", normalizedEndpoint)
    }

    const { error } = await query
    if (error) {
      throw new Error(error.message)
    }

    return new Response(JSON.stringify({ success: true }), {
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
