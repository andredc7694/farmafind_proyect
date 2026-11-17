export const PLATFORM_ROLE = 'ADMINISTRADOR_PLATAFORMA' as const;

export const PLATFORM_PERMISSIONS = [
  'PLATFORM_USER_READ',
  'PLATFORM_USER_STATUS_MANAGE',
  'PLATFORM_GLOBAL_AUTH_READ',
  'PLATFORM_GLOBAL_AUTH_MANAGE',
  'PLATFORM_AUDIT_READ',
] as const;

export function validPlatformMutation(input: {
  actorUserId: string;
  targetUserId: string;
  role: string;
  approvalId: string;
}): boolean {
  return input.actorUserId !== input.targetUserId && input.role === PLATFORM_ROLE &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.approvalId);
}

export function validPlatformApproval(approvalId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(approvalId);
}
