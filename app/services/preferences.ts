/**
 * Persistent user state: favourites, completed courses and the selected
 * term.
 *
 * Backed by the storage shim (MMKV on native, localStorage on web) — the
 * same "save it locally" approach rouste uses for its saved plans. The
 * store is a module-level value plus `useSyncExternalStore`, so every
 * screen sees updates without a state-management dependency.
 */
import { useSyncExternalStore } from "react"

import { getTerms } from "@/services/courses"
import * as storage from "@/utils/storage"

const FAVOURITES_KEY = "explorer.favourites"
const COMPLETED_KEY = "explorer.completed"
const TERM_KEY = "explorer.term"

function readCodes(key: string): string[] {
  const value = storage.load<string[]>(key)
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : []
}

let favourites: string[] = readCodes(FAVOURITES_KEY)
let completed: string[] = readCodes(COMPLETED_KEY)

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// --- favourites ------------------------------------------------------------

export const getFavourites = () => favourites
export const isFavourite = (code: string) => favourites.includes(code)

/** Adds or removes a course from the favourites list. */
export function toggleFavourite(code: string): void {
  favourites = favourites.includes(code)
    ? favourites.filter((c) => c !== code)
    : [...favourites, code].sort()
  storage.save(FAVOURITES_KEY, favourites)
  emit()
}

// --- completed courses (prerequisite checking) -----------------------------

export const getCompleted = () => completed
export const isCompleted = (code: string) => completed.includes(code)

/** Marks a course as taken / not taken, for prerequisite evaluation. */
export function toggleCompleted(code: string): void {
  completed = completed.includes(code)
    ? completed.filter((c) => c !== code)
    : [...completed, code].sort()
  storage.save(COMPLETED_KEY, completed)
  emit()
}

// --- selected term ---------------------------------------------------------

/** The term the user last chose, validated against the dataset. */
export function loadTerm(): string {
  const stored = storage.loadString(TERM_KEY)
  const codes = getTerms().map((t) => t.code)
  return stored && codes.includes(stored) ? stored : (codes[0] ?? "")
}

export function saveTerm(term: string): void {
  storage.saveString(TERM_KEY, term)
}

// --- React bindings --------------------------------------------------------

export function useFavourites(): string[] {
  return useSyncExternalStore(subscribe, getFavourites)
}

export function useCompleted(): string[] {
  return useSyncExternalStore(subscribe, getCompleted)
}
