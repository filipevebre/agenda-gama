import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase()
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

    if (!callerProfile || !["administrador", "funcionarios"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { record, previousRecord, siteUrl } = await req.json()
    const normalizedEmail = normalizeEmail(record?.email)
    const configuredSiteUrl = String(siteUrl || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "")

    if (!record?.nome || !record?.parentesco || !record?.aluno_id || !record?.contato || !normalizedEmail) {
      return new Response(JSON.stringify({ error: "Dados obrigatorios ausentes." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (!configuredSiteUrl) {
      return new Response(JSON.stringify({
        error: "Defina a URL publica do site no frontend ou na variavel SITE_URL do Supabase."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (
      previousRecord?.auth_user_id &&
      previousRecord?.email &&
      normalizeEmail(previousRecord.email) !== normalizedEmail
    ) {
      return new Response(JSON.stringify({
        error: "Para trocar o e-mail de acesso de um responsavel ja convidado, exclua e cadastre novamente."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (existingProfile && existingProfile.role !== "responsaveis") {
      return new Response(JSON.stringify({ error: "Este e-mail ja esta em uso em outro perfil do sistema." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: alunoRecord, error: alunoError } = await adminClient
      .from("alunos")
      .select("id, nome")
      .eq("id", record.aluno_id)
      .maybeSingle()

    if (alunoError) {
      return new Response(JSON.stringify({ error: alunoError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (!alunoRecord) {
      return new Response(JSON.stringify({ error: "Selecione um aluno ja cadastrado para vincular este responsavel." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    let authUserId = previousRecord?.auth_user_id || existingProfile?.id || null
    let accessStatus = existingProfile?.first_access_pending ? "Convite enviado" : "Acesso ativo"
    let notice = null

    if (!authUserId) {
      const inviteResponse = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: `${configuredSiteUrl}/app/criar-senha.html`,
        data: {
          full_name: record.nome,
          role: "responsaveis",
          role_label: "Responsavel",
          first_access_pending: true
        }
      })

      if (inviteResponse.error) {
        return new Response(JSON.stringify({ error: inviteResponse.error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      authUserId = inviteResponse.data.user?.id || inviteResponse.data?.id || null
      accessStatus = "Convite enviado"
      notice = {
        email: normalizedEmail,
        status: "Convite enviado",
        mailActionText: "O Supabase enviou o convite usando o provedor de e-mail configurado no projeto."
      }
    }

    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Nao foi possivel identificar o usuario autenticavel do responsavel." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: authUserId,
      email: normalizedEmail,
      full_name: record.nome,
      role: "responsaveis",
      role_label: "Responsavel",
      can_approve: false,
      first_access_pending: accessStatus === "Convite enviado"
    })

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const payload = {
      id: record.id || undefined,
      auth_user_id: authUserId,
      aluno_id: alunoRecord.id,
      nome: record.nome,
      parentesco: record.parentesco,
      aluno: alunoRecord.nome,
      contato: record.contato,
      email: normalizedEmail,
      access_status: accessStatus
    }

    const { data: savedRecord, error: saveError } = await adminClient
      .from("responsaveis")
      .upsert(payload)
      .select("*")
      .single()

    if (saveError) {
      return new Response(JSON.stringify({ error: saveError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({
      record: savedRecord,
      notice
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
