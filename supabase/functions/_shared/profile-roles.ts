export const PROFILE_ROLES = ["administrador", "funcionarios", "professores", "responsaveis"] as const

export type ProfileRole = typeof PROFILE_ROLES[number]

export function profileRoleLabel(role: ProfileRole) {
  if (role === "administrador") return "Administrador"
  if (role === "funcionarios") return "Funcionário"
  if (role === "professores") return "Professor"
  return "Responsável"
}

export function canManageSchool(role: string) {
  return role === "administrador"
}

export async function saveProfileRole(
  adminClient: any,
  params: {
    userId: string
    email: string
    fullName: string
    role: ProfileRole
    existingProfile?: Record<string, any> | null
    firstAccessPending: boolean
  }
) {
  const activeRole = (params.existingProfile?.role || params.role) as ProfileRole
  const profilePayload = {
    id: params.userId,
    email: params.email,
    full_name: params.existingProfile?.full_name || params.fullName,
    role: activeRole,
    role_label: params.existingProfile?.role_label || profileRoleLabel(activeRole),
    can_approve: Boolean(params.existingProfile?.can_approve),
    first_access_pending: params.firstAccessPending
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(profilePayload)
  if (profileError) throw profileError

  const { error: roleError } = await adminClient.from("profile_roles").upsert({
    user_id: params.userId,
    role: params.role,
    role_label: profileRoleLabel(params.role)
  })
  if (roleError) throw roleError
}

export async function removeProfileRoleOrAccount(
  adminClient: any,
  params: {
    userId: string
    role: ProfileRole
    keepRole: boolean
  }
) {
  if (params.keepRole) return

  const { error: removeRoleError } = await adminClient
    .from("profile_roles")
    .delete()
    .eq("user_id", params.userId)
    .eq("role", params.role)
  if (removeRoleError) throw removeRoleError

  const { data: remainingRoles, error: rolesError } = await adminClient
    .from("profile_roles")
    .select("role, role_label")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true })
  if (rolesError) throw rolesError

  if (!remainingRoles?.length) {
    await adminClient.from("profiles").delete().eq("id", params.userId)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(params.userId)
    if (deleteUserError) throw deleteUserError
    return
  }

  const { data: currentProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", params.userId)
    .maybeSingle()
  if (profileError) throw profileError

  if (currentProfile?.role === params.role) {
    const nextRole = remainingRoles[0]
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ role: nextRole.role, role_label: nextRole.role_label })
      .eq("id", params.userId)
    if (updateError) throw updateError
  }
}
