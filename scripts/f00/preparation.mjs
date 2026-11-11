export function preparation(preparationId, source, details = {}) {
  if (!['A', 'B'].includes(preparationId) || !source?.hash) throw new Error('Preparación inválida');
  return {
    preparationId,
    sourceRevision: { hash: source.hash, lockfileHash: source.lockfileHash ?? null, commit: details.commit ?? null },
    workingDirectory: details.workingDirectory ?? null,
    platform: details.platform ?? { os: process.platform, architecture: process.arch, node: process.version, npm: null, shell: null, browser: 'pending' },
    prerequisites: details.prerequisites ?? 'pending',
    actor: details.actor ?? null,
    status: details.status ?? 'pending',
  };
}
