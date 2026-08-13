import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
import { canManageSchool, profileRoleLabel, type ProfileRole } from "../_shared/profile-roles.ts"

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase()
}

function isProfileRole(role: string): role is ProfileRole {
  return ["administrador", "funcionarios", "professores", "responsaveis"].includes(role)
}

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
    if (!callerProfile || !canManageSchool(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { record, role, siteUrl } = await req.json()
    const normalizedEmail = normalizeEmail(record?.email)
    const requestedRole = String(role || "")
    const configuredSiteUrl = String(siteUrl || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "")

    if (!normalizedEmail || !isProfileRole(requestedRole)) {
      return new Response(JSON.stringify({ error: "E-mail ou perfil invalido para o reenvio." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    if (!configuredSiteUrl) {
      return new Response(JSON.stringify({ error: "A URL publica do Agenda Gama nao esta configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, full_name, first_access_pending")
      .eq("email", normalizedEmail)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile) {
      return new Response(JSON.stringify({ error: "Nao foi encontrada uma conta vinculada a este e-mail." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: linkedRole, error: linkedRoleError } = await adminClient
      .from("profile_roles")
      .select("role")
      .eq("user_id", profile.id)
      .eq("role", requestedRole)
      .maybeSingle()
    if (linkedRoleError) throw linkedRoleError
    if (!linkedRole) {
      return new Response(JSON.stringify({ error: "Este perfil nao esta vinculado a conta informada." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: userResponse, error: userError } = await adminClient.auth.admin.getUserById(profile.id)
    if (userError || !userResponse.user) {
      return new Response(JSON.stringify({ error: userError?.message || "Usuario de acesso nao encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (userResponse.user.email_confirmed_at || !profile.first_access_pending) {
      return new Response(JSON.stringify({ error: "Esta conta ja concluiu o primeiro acesso e nao precisa de um novo convite." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const inviteResponse = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${configuredSiteUrl}/app/criar-senha.html`,
      data: {
        ...userResponse.user.user_metadata,
        full_name: profile.full_name || record?.nome || normalizedEmail,
        role: requestedRole,
        role_label: profileRoleLabel(requestedRole),
        first_access_pending: true
      }
    })
    if (inviteResponse.error) {
      return new Response(JSON.stringify({ error: inviteResponse.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      email: normalizedEmail,
      message: `Convite reenviado para ${normalizedEmail}.`
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
