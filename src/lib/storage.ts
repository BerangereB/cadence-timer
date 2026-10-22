import { createSession, type Session } from "@/lib/session"
import {
  sanitizeProgrammation,
  type PendingImport,
  type Programmation,
} from "@/lib/programmation"

export type Settings = {
  warnAtPercent: number
  soundEnabled: boolean
  notifySystem: boolean
  autoAdvance: boolean
  notionToken: string
  notionPageUrl: string
  autoImport: boolean
}

const SETTINGS_KEY = "cadence.settings.v1"
const PROGRAMMATIONS_KEY = "cadence.programmations.v1"
const SESSION_KEY = "cadence.session.v1"
const PENDING_KEY = "cadence.pending.v1"

export const defaultSettings: Settings = {
  warnAtPercent: 80,
  soundEnabled: true,
  notifySystem: false,
  autoAdvance: true,
  notionToken: "",
  notionPageUrl: "",
  autoImport: false,
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // stockage indisponible
  }
}

export function loadSettings(): Settings {
  const raw = read(SETTINGS_KEY)
  if (!raw || typeof raw !== "object") return { ...defaultSettings }
  const record = raw as Partial<Settings>
  const warn = Number(record.warnAtPercent)
  return {
    warnAtPercent: Number.isFinite(warn) ? Math.min(95, Math.max(50, Math.round(warn))) : 80,
    soundEnabled: record.soundEnabled !== false,
    notifySystem: record.notifySystem === true,
    autoAdvance: record.autoAdvance !== false,
    notionToken: typeof record.notionToken === "string" ? record.notionToken : "",
    notionPageUrl: typeof record.notionPageUrl === "string" ? record.notionPageUrl : "",
    autoImport: record.autoImport === true,
  }
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings)
}

export function loadProgrammations(): Programmation[] {
  const raw = read(PROGRAMMATIONS_KEY)
  if (!Array.isArray(raw)) return []
  return raw.map(sanitizeProgrammation).filter((item): item is Programmation => item !== null)
}

export function saveProgrammations(programmations: Programmation[]): void {
  write(PROGRAMMATIONS_KEY, programmations)
}

export function loadSession(): Session {
  const raw = read(SESSION_KEY)
  if (!raw || typeof raw !== "object") return createSession(null)
  const record = raw as Partial<Session>
  const status = record.status
  if (status !== "idle" && status !== "running" && status !== "paused" && status !== "done") {
    return createSession(null)
  }
  return {
    programmationId: typeof record.programmationId === "string" ? record.programmationId : null,
    stepIndex: Number.isFinite(record.stepIndex) ? Math.max(0, record.stepIndex ?? 0) : 0,
    status,
    elapsedMs: Number.isFinite(record.elapsedMs) ? Math.max(0, record.elapsedMs ?? 0) : 0,
    runStartedAt: typeof record.runStartedAt === "number" ? record.runStartedAt : null,
    warned: record.warned === true,
    ended: record.ended === true,
    visit: Number.isFinite(record.visit) ? record.visit ?? 0 : 0,
  }
}

export function saveSession(session: Session): void {
  write(SESSION_KEY, session)
}

export function loadPending(): PendingImport | null {
  const raw = read(PENDING_KEY)
  if (!raw || typeof raw !== "object") return null
  const record = raw as Partial<PendingImport>
  if (!Array.isArray(record.programmations)) return null
  const programmations = record.programmations
    .map(sanitizeProgrammation)
    .filter((item): item is Programmation => item !== null)
  if (programmations.length === 0) return null
  return {
    programmations,
    selectId: typeof record.selectId === "string" ? record.selectId : null,
    label: typeof record.label === "string" ? record.label : "Import",
  }
}

export function savePending(pending: PendingImport | null): void {
  if (!pending) {
    try {
      localStorage.removeItem(PENDING_KEY)
    } catch {
      // ignore
    }
    return
  }
  write(PENDING_KEY, pending)
}
