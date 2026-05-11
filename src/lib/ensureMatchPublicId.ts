import { updateDoc, type DocumentReference } from 'firebase/firestore'

/**
 * Assigns a stable `publicId` for `/live/:id` and `/overlay/:id` when missing.
 * New matches always set this at create; legacy documents may omit it.
 */
export async function ensureMatchPublicId(
  matchRef: DocumentReference,
  existingPublicId: string | undefined,
  run: (fn: () => Promise<void>) => Promise<void>,
): Promise<string> {
  const trimmed = existingPublicId?.trim()
  if (trimmed) return trimmed
  const token = crypto.randomUUID()
  await run(() => updateDoc(matchRef, { publicId: token }))
  return token
}
