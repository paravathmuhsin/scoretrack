#!/usr/bin/env node
/**
 * STAGING / TEST ONLY — never run against production Firebase.
 *
 * Bulk-create email/password test users in Firebase Auth + minimal profile + directory row
 * so "Add player from directory" and squad flows can be exercised.
 *
 * Usage (scoretrack-staging, Email/Password Auth enabled):
 *   yarn seed:staging:test-users -- --count 100 --password 'YourTestPass1!'
 *
 * Requires `--confirm-staging` (or yarn script passes it). Reads `.env.staging` only.
 * Emails: test1@example.com … (RFC 2606 — no real inbox).
 */

/** Only these Firebase project IDs may be targeted. */
const ALLOWED_PROJECT_IDS = new Set(['scoretrack-staging'])

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvStaging() {
  const path = resolve(root, '.env.staging')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

function parseArgs(argv) {
  let count = 10
  let password = 'TestPass123!'
  let start = 1
  let confirmStaging = false
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--count') count = Number(argv[++i])
    else if (argv[i] === '--password') password = argv[++i]
    else if (argv[i] === '--start') start = Number(argv[++i])
    else if (argv[i] === '--confirm-staging') confirmStaging = true
  }
  if (!confirmStaging) {
    throw new Error(
      'Refusing to run without --confirm-staging (this script is for test Firebase projects only).',
    )
  }
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    throw new Error('--count must be 1–500')
  }
  if (!password || password.length < 6) {
    throw new Error('--password must be at least 6 characters (Firebase requirement)')
  }
  return { count, password, start, confirmStaging }
}

async function signUp(apiKey, email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const body = await res.json()
  if (!res.ok) {
    const msg = body?.error?.message ?? res.statusText
    return { ok: false, error: msg }
  }
  return {
    ok: true,
    uid: body.localId,
    idToken: body.idToken,
  }
}

async function createFirestoreDoc(projectId, collection, uid, idToken, plain) {
  const fields = Object.fromEntries(
    Object.entries(plain).map(([k, v]) => [k, v == null ? { nullValue: null } : { stringValue: String(v) }]),
  )
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?documentId=${encodeURIComponent(uid)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const code = body?.error?.status
    if (code === 'ALREADY_EXISTS') return
    throw new Error(body?.error?.message ?? `Firestore ${collection}/${uid} ${res.status}`)
  }
}

async function main() {
  const { count, password, start } = parseArgs(process.argv)
  const env = loadEnvStaging()
  const apiKey = env.VITE_FIREBASE_API_KEY
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  if (!apiKey || !projectId) {
    throw new Error('Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID in .env.staging')
  }
  if (!ALLOWED_PROJECT_IDS.has(projectId)) {
    throw new Error(
      `Refusing to run: project "${projectId}" is not in the allowlist (${[...ALLOWED_PROJECT_IDS].join(', ')}). ` +
        'Use .env.staging pointed at scoretrack-staging only.',
    )
  }

  console.log(`[TEST ONLY] Firebase project: ${projectId}`)
  console.log(`Creating ${count} users (test${start}@example.com …)`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (let n = start; n < start + count; n++) {
    const email = `test${n}@example.com`
    const displayName = `Test ${n}`
    const fullName = `Test User ${n}`
    const mobile = String(9000000000 + n).slice(0, 10)

    const auth = await signUp(apiKey, email, password)
    if (!auth.ok) {
      if (auth.error === 'EMAIL_EXISTS') {
        skipped++
        console.log(`  skip ${email} (exists)`)
        continue
      }
      failed++
      console.error(`  fail ${email}: ${auth.error}`)
      continue
    }

    try {
      await createFirestoreDoc(projectId, 'users', auth.uid, auth.idToken, {
        fullName,
        displayName,
        mobile,
      })
      await createFirestoreDoc(projectId, 'directoryUsers', auth.uid, auth.idToken, {
        displayName,
        displayNameLower: displayName.toLowerCase(),
        fullName,
        fullNameLower: fullName.toLowerCase(),
        email,
        emailLower: email.toLowerCase(),
        phoneDigits: mobile,
        photoURL: null,
      })
      created++
      console.log(`  ok ${email} → ${displayName}`)
    } catch (e) {
      failed++
      console.error(`  partial ${email} (auth ok, profile failed):`, e.message)
    }

    await new Promise((r) => setTimeout(r, 120))
  }

  console.log(`Done. created=${created} skipped=${skipped} failed=${failed}`)
  console.log(`Shared password: (the one you passed with --password)`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
