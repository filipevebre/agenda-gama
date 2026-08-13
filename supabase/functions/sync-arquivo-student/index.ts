import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const ARQUIVO_SUPABASE_URL = "https://xcsukwbzxatmnlkfrtep.supabase.co"
const ARQUIVO_SUPABASE_ANON_KEY = "sb_publishable_Mqeh3uei8srfWkZjfSByYQ_tRwUPu23"
const ALLOWED_ROLES = new Set(["administrador", "secretaria", "direcao", "coordenacao"])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
}

function turmaCandidates(grade: unknown, className: unknown) {
  const gradeLabel = String(grade || "").trim()
  const classLabel = String(className || "").trim()
  return [
    [gradeLabel, classLabel].filter(Boolean).join(" - "),
    [gradeLabel, classLabel].filter(Boolean).join(" "),
    gradeLabel,
    classLabel
  ].filter(Boolean)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Metodo nao permitido." }, 405)

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Acesso do Arquivo Virtual nao informado." }, 401)

    const sourceClient = createClient(ARQUIVO_SUPABASE_URL, ARQUIVO_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: authData, error: authError } = await sourceClient.auth.getUser()
    if (authError || !authData.user) return json({ error: "Sessao do Arquivo Virtual invalida." }, 401)

    const { data: profile, error: profileError } = await sourceClient
      .from("arquivo_profiles")
      .select("role,active")
      .eq("id", authData.user.id)
      .single()

    if (profileError || !profile?.active || !ALLOWED_ROLES.has(profile.role)) {
      return json({ error: "Seu perfil nao pode sincronizar alunos." }, 403)
    }

    const { studentId } = await req.json()
    if (!studentId) return json({ error: "Aluno nao informado." }, 400)

    const { data: sourceStudent, error: studentError } = await sourceClient
      .from("arquivo_students")
      .select("id,full_name,registration,arquivo_enrollments(id,school_year,grade,class_name,shift,status,updated_at)")
      .eq("id", studentId)
      .single()

    if (studentError || !sourceStudent) return json({ error: "Aluno nao encontrado no Arquivo Virtual." }, 404)

    const enrollments = [...(sourceStudent.arquivo_enrollments || [])].sort((left, right) => {
      return Number(right.school_year || 0) - Number(left.school_year || 0)
    })
    const enrollment = enrollments[0]
    if (!enrollment) return json({ error: "O aluno ainda nao possui matricula." }, 400)
    if (["transferida", "cancelada"].includes(normalize(enrollment.status))) {
      return json({ skipped: true, reason: `Matricula ${String(enrollment.status).toLowerCase()}.` })
    }

    const destinationUrl = Deno.env.get("SUPABASE_URL")!
    const destinationServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const destinationClient = createClient(destinationUrl, destinationServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: destinationTurmas, error: turmaError } = await destinationClient
      .from("turmas")
      .select("id,nome,turno,ano")
    if (turmaError) throw turmaError

    const candidates = turmaCandidates(enrollment.grade, enrollment.class_name)
    const normalizedCandidates = candidates.map(normalize)
    let turma = (destinationTurmas || []).find((item) => normalizedCandidates.includes(normalize(item.nome))) || null
    let turmaCreated = false
    const turno = String(enrollment.shift || turma?.turno || "Nao informado").trim()

    if (!turma) {
      const turmaName = candidates[0] || "Turma nao informada"
      const { data: createdTurma, error: createTurmaError } = await destinationClient
        .from("turmas")
        .insert({
          nome: turmaName,
          turno,
          sala: "Nao informada",
          ano: String(enrollment.school_year || new Date().getFullYear())
        })
        .select("id,nome,turno,ano")
        .single()
      if (createTurmaError) throw createTurmaError
      turma = createdTurma
      turmaCreated = true
    }

    const registration = String(sourceStudent.registration || `ARQ-${String(sourceStudent.id).slice(0, 8).toUpperCase()}`).trim()
    const { data: existingStudents, error: existingError } = await destinationClient
      .from("alunos")
      .select("id,nome,matricula")
    if (existingError) throw existingError

    const existing = (existingStudents || []).find((student) => {
      return normalize(student.matricula) === normalize(registration)
        || (!sourceStudent.registration && normalize(student.nome) === normalize(sourceStudent.full_name))
    })
    const payload = {
      nome: String(sourceStudent.full_name || "").trim(),
      matricula: registration,
      turma: turma.nome,
      turno
    }
    if (!payload.nome) return json({ error: "O aluno esta sem nome no Arquivo Virtual." }, 400)

    if (existing) {
      const { data: updated, error: updateError } = await destinationClient
        .from("alunos")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single()
      if (updateError) throw updateError
      return json({ action: "updated", student: updated, turmaCreated })
    }

    const { data: created, error: createError } = await destinationClient
      .from("alunos")
      .insert(payload)
      .select()
      .single()
    if (createError) throw createError
    return json({ action: "created", student: created, turmaCreated })
  } catch (error) {
    console.error("sync-arquivo-student", error)
    return json({ error: error instanceof Error ? error.message : "Nao foi possivel sincronizar o aluno." }, 500)
  }
})
