export function configProfile(profile) {
  if (!profile?.profileId || !['public', 'private', 'future_disabled'].includes(profile.visibility) || !profile.source || !Array.isArray(profile.variables) || !['valid', 'rejected'].includes(profile.validation)) throw new Error('Perfil de configuración inválido');
  for (const variable of profile.variables) {
    if (!variable.name || !['string', 'integer'].includes(variable.type) || typeof variable.required !== 'boolean' || !['public', 'private', 'future_disabled'].includes(variable.visibility)) throw new Error(`${variable.name || 'variable'}: definición inválida`);
  }
  return { ...profile };
}
