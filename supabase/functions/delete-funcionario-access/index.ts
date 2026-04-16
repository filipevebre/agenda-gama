import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single()

    if (!callerProfile || !["administrador", "funcionarios"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { record } = await req.json()
    if (!record?.id) {
      return new Response(JSON.stringify({ error: "Registro invalido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { error: deleteRecordError } = await adminClient
      .from("equipe")
      .delete()
      .eq("id", record.id)

    if (deleteRecordError) {
      return new Response(JSON.stringify({ error: deleteRecordError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (record.auth_user_id) {
      const { data: remainingRecords } = await adminClient
        .from("equipe")
        .select("id")
        .eq("auth_user_id", record.auth_user_id)

      if (!remainingRecords || !remainingRecords.length) {
        await adminClient.from("profiles").delete().eq("id", record.auth_user_id)
        await adminClient.auth.admin.deleteUser(record.auth_user_id)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
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
