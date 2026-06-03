// ──────────────────────────────────────────────────────────────
// offlineDb.js — Dependency-гүй IndexedDB wrapper (offline горим).
// Зөвхөн client дээр ажиллана. Бүх функц typeof indexedDB шалгана.
//
// Object store-ууд:
//   templates — offline-enabled гэрээний загвар (бүтэн: template_content + schema_json)
//   drafts    — offline үүсгэсэн гэрээний draft (Алхам 3)
//   meta      — туслах утга (lastSyncedAt гэх мэт), keyPath: 'key'
// ──────────────────────────────────────────────────────────────

const DB_NAME    = 'malchin-geree-offline'
const DB_VERSION = 1

export const STORE = {
  TEMPLATES: 'templates',
  DRAFTS:    'drafts',
  META:      'meta',
}

const KEYPATHS = {
  [STORE.TEMPLATES]: 'template_id',
  [STORE.DRAFTS]:    'draft_id',
  [STORE.META]:      'key',
}

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB дэмжигдэхгүй байна'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const [name, keyPath] of Object.entries(KEYPATHS)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  return dbPromise
}

// readonly request → promise
function readReq(store, method, ...args) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const r = db.transaction(store, 'readonly').objectStore(store)[method](...args)
        r.onsuccess = () => resolve(r.result)
        r.onerror   = () => reject(r.error)
      }),
  )
}

// readwrite транзакц — fn(objectStore) дотор put/delete дуудна, complete дээр resolve
function write(store, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t  = db.transaction(store, 'readwrite')
        const os = t.objectStore(store)
        fn(os)
        t.oncomplete = () => resolve(true)
        t.onerror    = () => reject(t.error)
        t.onabort    = () => reject(t.error)
      }),
  )
}

// ── Public API ────────────────────────────────────────
export const getAll = (store)       => readReq(store, 'getAll')
export const get     = (store, key) => readReq(store, 'get', key)

export const put     = (store, item)  => write(store, (os) => os.put(item))
export const putAll  = (store, items) => write(store, (os) => { for (const it of items) os.put(it) })
export const del     = (store, key)   => write(store, (os) => os.delete(key))
export const clear   = (store)        => write(store, (os) => os.clear())

// meta туслах
export const getMeta = async (key) => (await get(STORE.META, key))?.value ?? null
export const setMeta = (key, value) => put(STORE.META, { key, value })

export const isSupported = () => typeof indexedDB !== 'undefined'
