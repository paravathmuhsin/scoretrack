/**
 * In-memory Firestore stub for Storybook (Vite alias on `firebase/firestore`).
 */

type DocData = Record<string, unknown>

let seedStore: Record<string, DocData> = {}
const docListeners = new Map<string, Set<() => void>>()
const collectionListeners = new Map<string, Set<() => void>>()

export function resetFirestoreSeed(seed: Record<string, DocData> = {}) {
  seedStore = { ...seed }
  docListeners.forEach((set) => set.forEach((fn) => fn()))
  collectionListeners.forEach((set) => set.forEach((fn) => fn()))
}

function notifyDoc(path: string) {
  docListeners.get(path)?.forEach((fn) => fn())
}

function notifyCollection(prefix: string) {
  collectionListeners.get(prefix)?.forEach((fn) => fn())
}

function pathKey(segments: string[]): string {
  return segments.filter(Boolean).join('/')
}

export class Timestamp {
  readonly seconds: number
  readonly nanoseconds: number

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }

  static fromDate(date: Date): Timestamp {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0)
  }

  static now(): Timestamp {
    return Timestamp.fromDate(new Date())
  }

  toDate(): Date {
    return new Date(this.seconds * 1000)
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6)
  }
}

export class DocumentReference {
  constructor(readonly path: string) {}

  get id(): string {
    const parts = this.path.split('/')
    return parts[parts.length - 1] ?? ''
  }
}

export class CollectionReference {
  constructor(readonly path: string) {}
}

export class DocumentSnapshot {
  constructor(
    readonly ref: DocumentReference,
    private readonly _data: DocData | undefined,
  ) {}

  exists(): boolean {
    return this._data !== undefined
  }

  data(): DocData | undefined {
    return this._data
  }

  get id(): string {
    return this.ref.id
  }
}

export class QueryDocumentSnapshot extends DocumentSnapshot {}

export class QuerySnapshot {
  constructor(readonly docs: QueryDocumentSnapshot[]) {}

  get empty(): boolean {
    return this.docs.length === 0
  }

  forEach(fn: (doc: QueryDocumentSnapshot) => void) {
    this.docs.forEach(fn)
  }
}

export function doc(_db: unknown, ...pathSegments: string[]): DocumentReference {
  return new DocumentReference(pathKey(pathSegments))
}

export function collection(_db: unknown, ...pathSegments: string[]): CollectionReference {
  return new CollectionReference(pathKey(pathSegments))
}

export function collectionGroup(_db: unknown, collectionId: string): CollectionReference {
  return new CollectionReference(`__collectionGroup__/${collectionId}`)
}

function snapshotForRef(ref: DocumentReference): DocumentSnapshot {
  const data = seedStore[ref.path]
  return new DocumentSnapshot(ref, data ? { ...data } : undefined)
}

function snapshotsForCollection(col: CollectionReference): QueryDocumentSnapshot[] {
  if (col.path.startsWith('__collectionGroup__/')) {
    const segment = col.path.split('/')[1]!
    return Object.entries(seedStore)
      .filter(([key]) => {
        const parts = key.split('/')
        return parts.includes(segment)
      })
      .map(([key, data]) => new QueryDocumentSnapshot(new DocumentReference(key), { ...data }))
  }

  const prefix = `${col.path}/`
  return Object.entries(seedStore)
    .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
    .map(([key, data]) => new QueryDocumentSnapshot(new DocumentReference(key), { ...data }))
}

export function onSnapshot(
  ref: DocumentReference | CollectionReference,
  callback: (snap: DocumentSnapshot | QuerySnapshot) => void,
): () => void {
  if (ref instanceof DocumentReference) {
    const emit = () => callback(snapshotForRef(ref))
    emit()
    const set = docListeners.get(ref.path) ?? new Set()
    set.add(emit)
    docListeners.set(ref.path, set)
    return () => set.delete(emit)
  }

  const emit = () => callback(new QuerySnapshot(snapshotsForCollection(ref)))
  emit()
  const set = collectionListeners.get(ref.path) ?? new Set()
  set.add(emit)
  collectionListeners.set(ref.path, set)
  return () => set.delete(emit)
}

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  return snapshotForRef(ref)
}

export async function setDoc(ref: DocumentReference, data: DocData): Promise<void> {
  seedStore[ref.path] = { ...data }
  notifyDoc(ref.path)
  notifyCollection(ref.path.split('/').slice(0, -1).join('/'))
}

export async function updateDoc(ref: DocumentReference, data: DocData): Promise<void> {
  seedStore[ref.path] = { ...(seedStore[ref.path] ?? {}), ...data }
  notifyDoc(ref.path)
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  delete seedStore[ref.path]
  notifyDoc(ref.path)
  notifyCollection(ref.path.split('/').slice(0, -1).join('/'))
}

export async function addDoc(col: CollectionReference, data: DocData): Promise<DocumentReference> {
  const id = `mock-${Object.keys(seedStore).length + 1}`
  const ref = new DocumentReference(`${col.path}/${id}`)
  seedStore[ref.path] = { ...data }
  notifyCollection(col.path)
  return ref
}

export function serverTimestamp(): Timestamp {
  return Timestamp.now()
}

export function query(ref: CollectionReference, ..._constraints: unknown[]): CollectionReference {
  return ref
}

export function where(..._args: unknown[]): unknown {
  return null
}

export function orderBy(..._args: unknown[]): unknown {
  return null
}

export function limit(..._args: unknown[]): unknown {
  return null
}

export function startAt(..._args: unknown[]): unknown {
  return null
}

export function endAt(..._args: unknown[]): unknown {
  return null
}

export async function getDocs(ref: CollectionReference): Promise<QuerySnapshot> {
  return new QuerySnapshot(snapshotsForCollection(ref))
}

export function deleteField(): symbol {
  return Symbol('deleteField')
}

export function arrayUnion(...items: unknown[]): unknown {
  return { __arrayUnion: items }
}

export function arrayRemove(...items: unknown[]): unknown {
  return { __arrayRemove: items }
}

export function increment(n: number): unknown {
  return { __increment: n }
}

type MockTransaction = {
  get: (ref: DocumentReference) => Promise<DocumentSnapshot>
  set: (ref: DocumentReference, data: DocData) => void
  update: (ref: DocumentReference, data: DocData) => void
  delete: (ref: DocumentReference) => void
}

export async function runTransaction<T>(
  _db: unknown,
  updateFunction: (transaction: MockTransaction) => Promise<T>,
): Promise<T> {
  const tx: MockTransaction = {
    get: (ref) => getDoc(ref),
    set: (ref, data) => {
      seedStore[ref.path] = { ...data }
    },
    update: (ref, data) => {
      seedStore[ref.path] = { ...(seedStore[ref.path] ?? {}), ...data }
    },
    delete: (ref) => {
      delete seedStore[ref.path]
    },
  }
  return updateFunction(tx)
}

export async function writeBatch(_db: unknown) {
  const ops: Array<() => void> = []
  return {
    set(ref: DocumentReference, data: DocData) {
      ops.push(() => {
        seedStore[ref.path] = { ...data }
      })
    },
    update(ref: DocumentReference, data: DocData) {
      ops.push(() => {
        seedStore[ref.path] = { ...(seedStore[ref.path] ?? {}), ...data }
      })
    },
    delete(ref: DocumentReference) {
      ops.push(() => {
        delete seedStore[ref.path]
      })
    },
    async commit() {
      ops.forEach((fn) => fn())
    },
  }
}

export type Firestore = Record<string, never>

export function getFirestore(): Firestore {
  return {}
}

export type DocumentReferenceType = DocumentReference
