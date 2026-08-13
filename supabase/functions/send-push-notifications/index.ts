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

type CommunicationEmailJob = {
  messageId: string
  to: string
  subject: string
  html: string
  text: string
}

function uniqueIds(items: string[]) {
  return [...new Set((items || []).filter(Boolean))]
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

async function buildIdempotencyKey(jobs: CommunicationEmailJob[]) {
  const source = jobs.map((job) => `${job.messageId}:${normalizeEmail(job.to)}`).sort().join("|")
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source))
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  return `agenda-gama-communication-${hash}`
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

function resolveRecipientEmails(
  directory: Directory,
  userIds: string[],
  message: Record<string, unknown>,
  thread: Record<string, unknown> | null,
  senderEmail: string
) {
  const targetUserIds = new Set(uniqueIds(userIds))
  const directoryRows = [
    ...(directory.profiles || []).map((item) => ({ userId: item.id, email: item.email })),
    ...(directory.responsaveis || []).map((item) => ({ userId: item.auth_user_id, email: item.email })),
    ...(directory.professores || []).map((item) => ({ userId: item.auth_user_id, email: item.email })),
    ...(directory.equipe || []).map((item) => ({ userId: item.auth_user_id, email: item.email }))
  ]
  const allowedEmails = new Set(directoryRows.map((item) => normalizeEmail(String(item.email || ""))).filter(isEmail))
  const emails = new Set<string>()
  const normalizedSender = normalizeEmail(senderEmail)

  const addEmail = (value: unknown, requireDirectoryMatch = true) => {
    const email = normalizeEmail(String(value || ""))
    if (!isEmail(email) || email === normalizedSender) return
    if (requireDirectoryMatch && !allowedEmails.has(email)) return
    emails.add(email)
  }

  directoryRows.forEach((item) => {
    if (item.userId && targetUserIds.has(String(item.userId))) {
      addEmail(item.email)
    }
  })

  if (String(message.sender_role || "") !== "responsaveis") {
    addEmail(thread?.responsibleEmail)
    const targets = Array.isArray(thread?.targetResponsaveis) ? thread?.targetResponsaveis as Array<Record<string, unknown>> : []
    targets.forEach((item) => addEmail(item.responsibleEmail))
    const recipients = Array.isArray(message.recipients) ? message.recipients as unknown[] : []
    recipients.forEach((item) => addEmail(item))
  }

  return [...emails]
}

function buildCommunicationPayload(message: Record<string, unknown>, thread: Record<string, unknown> | null, text: string) {
  const status = String(message?.status || "")
  const threadKey = String(thread?.key || "")
  const preview = previewText(text || "Abra o chat para acompanhar o atendimento.")
  const context = String(thread?.studentName || thread?.turma || thread?.sector || "Atendimento")

  if (status === "pending_approval") {
    return {
      kind: "communication-approval",
      tag: `approval:${String(message?.id || threadKey || Date.now())}`,
      title: "Mensagem aguardando aprovacao",
      body: [context, preview].filter(Boolean).join(" - "),
      href: threadKey ? `/app/comunicacao.html?thread=${encodeURIComponent(threadKey)}` : buildAppUrl("/app/comunicacao.html")
    }
  }

  return {
    kind: "communication-thread",
    tag: `message:${String(message?.id || threadKey || Date.now())}`,
    title: String(message?.sender_role || "") === "responsaveis"
      ? `Nova mensagem em ${String(thread?.responsibleName || thread?.channelName || "Atendimento")}`
      : String(thread?.type || "") === "broadcast"
        ? `Novo aviso em ${String(thread?.channelName || "sua turma")}`
        : "Nova resposta da escola",
    body: [context, preview].filter(Boolean).join(" - "),
    href: threadKey ? `/app/comunicacao.html?thread=${encodeURIComponent(threadKey)}` : buildAppUrl("/app/comunicacao.html")
  }
}

function buildCommunicationEmail(
  message: Record<string, unknown>,
  thread: Record<string, unknown> | null,
  text: string,
  recipientEmail: string
): CommunicationEmailJob {
  const payload = buildCommunicationPayload(message, thread, text)
  const senderName = String(message.sender_name || (message.sender_role === "responsaveis" ? thread?.responsibleName : "Equipe escolar") || "Agenda Gama")
  const context = String(thread?.studentName || thread?.turma || thread?.sector || thread?.channelName || "Comunicacao escolar")
  const preview = previewText(text || "Abra o Agenda Gama para acompanhar esta conversa.", 240)
  const href = buildAppUrl(payload.href)
  const subject = `Agenda Gama | ${payload.title}`
  const safeTitle = escapeHtml(payload.title)
  const safeSender = escapeHtml(senderName)
  const safeContext = escapeHtml(context)
  const safePreview = escapeHtml(preview)
  const safeHref = escapeHtml(href)

  return {
    messageId: String(message.id || "message"),
    to: recipientEmail,
    subject,
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f2f6f8;font-family:Arial,sans-serif;color:#17314d">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f2f6f8">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;overflow:hidden;border:1px solid #dce6ec;border-radius:18px;background:#ffffff">
          <tr><td style="padding:24px 28px 16px;background:#0d315a;color:#ffffff">
            <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a9e3d4">Agenda Gama</div>
            <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25">${safeTitle}</h1>
          </td></tr>
          <tr><td style="padding:26px 28px">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.55">Uma nova mensagem foi publicada na comunicacao escolar.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;border-radius:14px;background:#f5f8fa">
              <tr><td style="padding:18px 20px">
                <p style="margin:0 0 7px;font-size:13px;color:#667b8f"><strong>Enviada por:</strong> ${safeSender}</p>
                <p style="margin:0 0 12px;font-size:13px;color:#667b8f"><strong>Referencia:</strong> ${safeContext}</p>
                <p style="margin:0;font-size:16px;line-height:1.55;color:#17314d">${safePreview}</p>
              </td></tr>
            </table>
            <a href="${safeHref}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#079879;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Abrir conversa</a>
            <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#7b8d9e">Este e um aviso automatico. Para responder, abra a conversa no Agenda Gama.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    text: `${payload.title}\n\nEnviada por: ${senderName}\nReferencia: ${context}\n\n${preview}\n\nAbra a conversa: ${href}\n\nEste e um aviso automatico do Agenda Gama.`
  }
}

async function sendCommunicationEmails(jobs: CommunicationEmailJob[]) {
  const apiKey = String(Deno.env.get("RESEND_API_KEY") || "").trim()
  const from = String(Deno.env.get("EMAIL_FROM") || Deno.env.get("RESEND_FROM_EMAIL") || "").trim()
  const replyTo = String(Deno.env.get("EMAIL_REPLY_TO") || "").trim()
  const uniqueJobs = [...new Map(jobs.map((job) => [`${job.messageId}:${normalizeEmail(job.to)}`, job])).values()]

  if (!apiKey || !from) {
    return {
      configured: false,
      queued: uniqueJobs.length,
      sent: 0,
      errors: uniqueJobs.length ? ["Configure RESEND_API_KEY e EMAIL_FROM nas secrets do Supabase."] : []
    }
  }

  let sent = 0
  const errors: string[] = []
  for (let index = 0; index < uniqueJobs.length; index += 100) {
    const chunk = uniqueJobs.slice(index, index + 100)
    try {
      const idempotencyKey = await buildIdempotencyKey(chunk)
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "AgendaGama/1.0",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(chunk.map((job) => ({
          from,
          to: [job.to],
          subject: job.subject,
          html: job.html,
          text: job.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
          tags: [{ name: "message_id", value: job.messageId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 256) }]
        })))
      })

      if (!response.ok) {
        const detail = await response.text()
        errors.push(`Resend ${response.status}: ${previewText(detail, 180)}`)
        continue
      }

      const result = await response.json()
      sent += Array.isArray(result?.data) ? result.data.length : chunk.length
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Nao foi possivel enviar o lote de e-mails.")
    }
  }

  return { configured: true, queued: uniqueJobs.length, sent, errors }
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
  const emailJobs: CommunicationEmailJob[] = []
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

    const recipientEmails = resolveRecipientEmails(directory, recipientUserIds, message, thread, String(message.sender_email || callerEmail))
    if (!recipientUserIds.length && !recipientEmails.length) continue

    if (recipientUserIds.length) {
      deliveries.push(await sendPushToUserIds(adminClient, recipientUserIds, buildCommunicationPayload(message, thread, text)))
    }
    recipientEmails.forEach((email) => {
      emailJobs.push(buildCommunicationEmail(message, thread, text, email))
    })
  }

  const emailDelivery = await sendCommunicationEmails(emailJobs)

  return {
    notifications: deliveries.length,
    deliveries,
    email: emailDelivery
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
