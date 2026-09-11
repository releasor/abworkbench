export function canSubmitToPool(input: { connected: boolean }): boolean {
  return input.connected
}

/** Any connected member may submit their own task to the shared team mainline. */
export function canSubmitToTeamMainline(input: {
  connected: boolean
  actorId: string
  sourceAuthorId: string
}): boolean {
  return input.connected && input.actorId === input.sourceAuthorId
}

export function canPromoteToMainline(input: {
  connected: boolean
  actorId: string
  localUserId: string
  leadIds: string[]
  sourceSpace: 'personal' | 'pool' | 'mainline'
  sourceAuthorId: string
}): boolean {
  if (input.sourceSpace === 'mainline') return false
  if (!input.connected) {
    return input.sourceSpace === 'personal' && input.sourceAuthorId === input.actorId
  }
  return input.leadIds.includes(input.actorId)
}
