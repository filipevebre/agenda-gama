import { corsHeaders } from "../_shared/cors.ts"
import {
  buildAppUrl,
  createAdminClient,
  createUserClient,
  getCallerProfile,
  normalizeEmail,
  normalizeText,
  parseEnvelopeContent,
  previewText,
  requireAuthenticatedUser,
  sendPushToUserIds,
  turmaMatches
} from "../_shared/push.ts"

type Directory = {
  alunos: Array<Record<string, unknown>>
  responsaveis: Array<Record<string, unknown>>
  professores: Array<Record<string, unknown>>
  equipe: Array<Record<string, unknown>>
  profiles: Array<Record<string, unknown>>
}

function uniqueIds(items: string[]) {
  return [...new Set((items || []).filter(Boolean))]
}

function getProfessorTurmas(record: Record<string, unknown>) {
  return String(record?.turmas || "")
    .split(",")
    .map((item) => item.split(" - ")[0].trim())
    .filter(Boolean)
}

function findStudentByName(directory: Directory, studentName: string) {
  return (directory.alunos || []).find((item) => normalizeText(String(item?.nome || "")) === normalizeText(studentName)) || null
}

function loadThread(message: Record<string, unknown>) {
  return parseEnvelopeContent(String(message?.content || "")).thread || null
}

async function loadDirectory(adminClient: ReturnType<typeof createAdminClient>): Promise<Directory> {
  const [alunosResult, responsaveisResult, professoresResult, equipeResult, profilesResult] = await Promise.all([
    adminClient.from("alunos").select("id, nome, turma"),
    adminClient.from("responsaveis").select("id, auth_user_id, aluno_id, aluno, email, nome"),
    adminClient.from("professores").select("auth_user_id, email, nome, turmas"),
    adminClient.from("equipe").select("auth_user_id, email, nome, cargo, setor"),
    adminClient.from("profiles").select("id, email, role, can_approve")
  ])

  const possibleErrors = [
    alunosResult.error,
    responsaveisResult.error,
    professoresResult.error,
    equipeResult.error,
    profilesResult.error
  ].filter(Boolean)

  if (possibleErrors.length) {
    throw new Error(possibleErrors[0]?.message || "Nao foi possivel carregar o diretorio de push.")
  }

  return {
    alunos: alunosResult.data || [],
    responsaveis: responsaveisResult.data || [],
    professores: professoresResult.data || [],
    equipe: equipeResult.data || [],
    profiles: profilesResult.data || []
  }
}

function resolveGuardianUserIds(directory: Directory, message: Record<string, unknown>, thread: Record<string, unknown> | null) {
  const responsaveis = (directory.responsaveis || []).filter((item) => Boolean(item?.auth_user_id))
  const userIds = new Set<string>()

  const addResponsavel = (candidate: Record<string, unknown> | null) => {
    if (!candidate?.auth_user_id) return
    userIds.add(String(candidate.auth_user_id))
  }

  const findResponsavel = (reference: Record<string, unknown>) => {
    return responsaveis.find((item) => {
      if (reference?.responsibleId && String(item.id || "") === String(reference.responsibleId)) return true
      if (reference?.responsibleEmail && normalizeEmail(String(item.email || "")) === normalizeEmail(String(reference.responsibleEmail || ""))) return true
      if (reference?.studentId && String(item.aluno_id || "") === String(reference.studentId)) return true
      return false
    }) || null
  }

  const threadTargets = Array.isArray(thread?.targetResponsaveis) ? thread?.targetResponsaveis as Array<Record<string, unknown>> : []
  threadTargets.forEach((target) => addResponsavel(findResponsavel(target)))

  if (!userIds.size && (thread?.responsibleId || thread?.responsibleEmail)) {
    addResponsavel(responsaveis.find((item) => {
      return String(item.id || "") === String(thread?.responsibleId || "")
        || normalizeEmail(String(item.email || "")) === normalizeEmail(String(thread?.responsibleEmail || ""))
    }) || null)
  }

  if (!userIds.size && (thread?.studentId || thread?.studentName)) {
    const resolvedStudentId = String(thread?.studentId || "") || String(findStudentByName(directory, String(thread?.studentName || ""))?.id || "")
    responsaveis.forEach((item) => {
      if (resolvedStudentId && String(item.aluno_id || "") === resolvedStudentId) {
        addResponsavel(item)
      }
    })
  }

  if (!userIds.size && (thread?.type === "broadcast" || String(message?.recipient_type || "") === "turmas")) {
    const turma = String(thread?.turma || "")
    if (turma) {
      const studentIds = new Set((directory.alunos || []).filter((item) => turmaMatches(String(item?.turma || ""), turma)).map((item) => String(item.id || "")))
      responsaveis.forEach((item) => {
        const studentId = String(item.aluno_id || "")
        const alunoName = String(item.aluno || "")
        const aluno = findStudentByName(directory, alunoName)
        if (studentIds.has(studentId) || (aluno?.id && studentIds.has(String(aluno.id)))) {
          addResponsavel(item)
        }
      })
    }
  }

  return uniqueIds([...userIds])
}

function resolveStaffUserIds(directory: Directory, thread: Record<string, unknown> | null, callerId: string, pendingApproval: boolean) {
  const userIds = new Set<string>()
  const profiles = directory.profiles || []

  if (pendingApproval) {
    profiles.forEach((profile) => {
      if ((profile?.can_approve || profile?.role === "administrador") && String(profile?.id || "") !== callerId) {
        userIds.add(String(profile.id))
      }
    })
    return uniqueIds([...userIds])
  }

  profiles.forEach((profile) => {
    if (profile?.role === "administrador" && String(profile?.id || "") !== callerId) {
      userIds.add(String(profile.id))
    }
  })

  const sector = normalizeText(String(thread?.sector || thread?.channelName || "secretaria"))
  const turma = String(thread?.turma || "")
  const channelType = normalizeText(String(thread?.channelType || ""))

  if (channelType === "professor" || sector.includes("professor")) {
    ;(directory.professores || []).forEach((item) => {
      if (!item?.auth_user_id || String(item.auth_user_id) === callerId) return
      if (!turma || getProfessorTurmas(item).some((candidate) => turmaMatches(candidate, turma))) {
        userIds.add(String(item.auth_user_id))
      }
    })
    return uniqueIds([...userIds])
  }

  ;(directory.equipe || []).forEach((item) => {
    if (!item?.auth_user_id || String(item.auth_user_id) === callerId) return
    const itemSector = normalizeText(String(item?.setor || ""))
    const itemCargo = normalizeText(String(item?.cargo || ""))
    if (!sector || itemSector.includes(sector) || sector.includes(itemSector) || itemCargo.includes(sector) || sector.includes(itemCargo)) {
      userIds.add(String(item.auth_user_id))
    }
  })

  return uniqueIds([...userIds])
}

function buildCommunicationPayload(message: Record<string, unknown>, thread: Record<string, unknown> | null, text: string) {
  const status = String(message?.status || "")
  const threadKey = String(thread?.key || "")
  const preview = previewText(text || "Abra o chat para acompanhar o atendimento.")
  const context = String(thread?.studentName || thread?.turma || thread?.sector || "Atendimento")

  if (status === "pending_approval") {
    return {
      kind: "communication-approval",
      tag: `approval:${threadKey || message.id || Date.now()}`,
      title: "Mensagem aguardando aprovacao",
      body: [context, preview].filter(Boolean).join(" - "),
      href: threadKey ? `/app/comunicacao.html?thread=${encodeURIComponent(threadKey)}` : buildAppUrl("/app/comunicacao.html")
    }
  }

  return {
    kind: "communication-thread",
    tag: `message:${threadKey || message.id || Date.now()}`,
    title: String(message?.sender_role || "") === "responsaveis"
      ? `Nova mensagem em ${String(thread?.responsibleName || thread?.channelName || "Atendimento")}`
      : String(thread?.type || "") === "broadcast"
        ? `Novo aviso em ${String(thread?.channelName || "sua turma")}`
        : "Nova resposta da escola",
    body: [context, preview].filter(Boolean).join(" - "),
    href: threadKey ? `/app/comunicacao.html?thread=${encodeURIComponent(threadKey)}` : buildAppUrl("/app/comunicacao.html")
  }
}

async function dispatchDiaryPushes(
  adminClient: ReturnType<typeof createAdminClient>,
  callerProfile: Record<string, unknown>,
  callerUser: { id: string; email?: string },
  entryIds: string[]
) {
  const uniqueEntryIds = uniqueIds(entryIds)
  if (!uniqueEntryIds.length) {
    return { notifications: 0, deliveries: [] as unknown[] }
  }

  const { data: entries, error } = await adminClient
    .from("student_diary_entries")
    .select("*")
    .in("id", uniqueEntryIds)

  if (error) {
    throw new Error(error.message)
  }

  const directory = await loadDirectory(adminClient)
  const deliveries = []

  for (const entry of entries || []) {
    const callerRole = String(callerProfile?.role || "")
    const callerEmail = normalizeEmail(String(callerProfile?.email || callerUser.email || ""))
    if (!["administrador", "funcionarios"].includes(callerRole) && !(callerRole === "professores" && normalizeEmail(String(entry.author_email || "")) === callerEmail)) {
      throw new Error("Forbidden.")
    }

    const guardianUserIds = uniqueIds((directory.responsaveis || []).filter((item) => {
      if (!item?.auth_user_id) return false
      if (entry.student_id && String(item.aluno_id || "") === String(entry.student_id)) return true
      return normalizeText(String(item.aluno || "")) === normalizeText(String(entry.student_name || ""))
    }).map((item) => String(item.auth_user_id || "")))

    if (!guardianUserIds.length) continue

    deliveries.push(await sendPushToUserIds(adminClient, guardianUserIds, {
      id: String(entry.id || ""),
      kind: "diary-entry",
      tag: `diary:${String(entry.id || "")}:${String(entry.updated_at || entry.created_at || "")}`,
      title: `Novo registro no diario de ${String(entry.student_name || "seu aluno")}`,
      body: [String(entry.turma || ""), String(entry.title || entry.category || "Novo registro disponivel")].filter(Boolean).join(" - "),
      href: `/app/diario.html?entry=${encodeURIComponent(String(entry.id || ""))}`
    }))
  }

  return {
    notifications: deliveries.length,
    deliveries
  }
}

async function dispatchCommunicationPushes(
  adminClient: ReturnType<typeof createAdminClient>,
  callerProfile: Record<string, unknown>,
  callerUser: { id: string; email?: string },
  messageIds: string[]
) {
  const uniqueMessageIds = uniqueIds(messageIds)
  if (!uniqueMessageIds.length) {
    return { notifications: 0, deliveries: [] as unknown[] }
  }

  const { data: messages, error } = await adminClient
    .from("communication_messages")
    .select("*")
    .in("id", uniqueMessageIds)

  if (error) {
    throw new Error(error.message)
  }

  const directory = await loadDirectory(adminClient)
  const deliveries = []
  const callerEmail = normalizeEmail(String(callerProfile?.email || callerUser.email || ""))
  const callerCanApprove = Boolean(callerProfile?.can_approve || callerProfile?.role === "administrador")

  for (const message of messages || []) {
    const parsed = parseEnvelopeContent(String(message.content || ""))
    const thread = (parsed.thread || loadThread(message)) as Record<string, unknown> | null
    const text = String(parsed.text || "")
    const status = String(message.status || "")

    if (Boolean(parsed.internalOnly) || Boolean(parsed.placeholder)) {
      continue
    }

    const callerIsSender = normalizeEmail(String(message.sender_email || "")) === callerEmail
    if (!callerIsSender && !callerCanApprove) {
      throw new Error("Forbidden.")
    }

    let recipientUserIds: string[] = []
    if (status === "pending_approval") {
      recipientUserIds = resolveStaffUserIds(directory, thread, callerUser.id, true)
    } else if (status === "sent") {
      recipientUserIds = String(message.sender_role || "") === "responsaveis"
        ? resolveStaffUserIds(directory, thread, callerUser.id, false)
        : resolveGuardianUserIds(directory, message, thread)
    } else {
      continue
    }

    if (!recipientUserIds.length) continue

    deliveries.push(await sendPushToUserIds(adminClient, recipientUserIds, buildCommunicationPayload(message, thread, text)))
  }

  return {
    notifications: deliveries.length,
    deliveries
  }
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

    const userClient = createUserClient(authHeader)
    const adminClient = createAdminClient()
    const callerUser = await requireAuthenticatedUser(userClient)
    const callerProfile = await getCallerProfile(adminClient, callerUser.id)
    const { kind, entryIds, messageIds } = await req.json()

    const result = String(kind || "") === "diary"
      ? await dispatchDiaryPushes(adminClient, callerProfile, callerUser, Array.isArray(entryIds) ? entryIds.map(String) : [])
      : await dispatchCommunicationPushes(adminClient, callerProfile, callerUser, Array.isArray(messageIds) ? messageIds.map(String) : [])

    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected error."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
