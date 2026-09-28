/**
 * Web implementation of the storage shim.
 *
 * The native build uses react-native-mmkv (see ./index.ts); MMKV has no web
 * back end, so the web bundle gets the same tiny synchronous API on top of
 * `localStorage` — the approach rouste uses for its saved plans. Metro picks
 * this file automatically on the web platform. Every access is guarded so
 * private-mode or quota errors degrade to an in-memory map instead of
 * crashing the app.
 */
const memory = new Map<string, string>()

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    memory.set(key, value)
  }
}

function drop(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    memory.delete(key)
  }
}

function clearAll(): void {
  try {
    window.localStorage.clear()
  } catch {
    memory.clear()
  }
}

function getAllKeys(): string[] {
  try {
    return Object.keys(window.localStorage)
  } catch {
    return [...memory.keys()]
  }
}

export const storage = {
  getString: read,
  set: write,
  delete: drop,
  clearAll,
  getAllKeys,
}

/**
 * Loads a string from storage.
 */
export function loadString(key: string): string | null {
  try {
    return storage.getString(key) ?? null
  } catch {
    return null
  }
}

/**
 * Saves a string to storage.
 */
export function saveString(key: string, value: string): boolean {
  try {
    storage.set(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Loads something from storage and runs it thru JSON.parse.
 */
export function load<T>(key: string): T | null {
  let almostThere: string | null = null
  try {
    almostThere = loadString(key)
    return JSON.parse(almostThere ?? "") as T
  } catch {
    return (almostThere as T) ?? null
  }
}

/**
 * Saves an object to storage.
 */
export function save(key: string, value: unknown): boolean {
  try {
    saveString(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Removes something from storage.
 */
export function remove(key: string): void {
  try {
    storage.delete(key)
  } catch {}
}

/**
 * Burn it all to the ground.
 */
export function clear(): void {
  try {
    storage.clearAll()
  } catch {}
}
