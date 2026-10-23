import type { Settings } from "./storage"

export type Step = {
  id: string
  name: string
  durationMs: number
  note?: string
}

export type ProgrammationSource = "local" | "notion" | "file" | "link"

export type Programmation = {
  id: string
  name: string
  steps: Step[]
  updatedAt: string
  source: ProgrammationSource
  notionPageId?: string
}

export type PendingImport = {
  programmations: Programmation[]
  selectId: string | null
  label: string
  settings?: Settings
}

const MAX_MS = 24 * 60 * 60 * 1000

export function createStep(name = "Nouvelle étape", durationMs = 5 * 60_000): Step {
  return { id: crypto.randomUUID(), name, durationMs }
}

export function createProgrammation(name: string, steps: Step[] = []): Programmation {
  return {
    id: crypto.randomUUID(),
    name,
    steps,
    updatedAt: new Date().toISOString(),
    source: "local",
  }
}

export function createExampleProgrammation(): Programmation {
  return createProgrammation("Séance exemple", [
    createStep("Échauffement", 5 * 60_000),
    createStep("Travail", 25 * 60_000),
    createStep("Pause", 5 * 60_000),
    createStep("Clôture", 5 * 60_000),
  ])
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function sanitizeStep(value: unknown): Step | null {
  const record = asRecord(value)
  if (!record) return null
  const durationMs = Number(record.durationMs)
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_MS) return null
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Étape"
  const note = typeof record.note === "string" && record.note.trim() ? record.note.trim() : undefined
  const id = typeof record.id === "string" && record.id.trim() ? record.id : crypto.randomUUID()
  return { id, name, durationMs, note }
}

export function sanitizeProgrammation(value: unknown): Programmation | null {
  const record = asRecord(value)
  if (!record) return null
  if (!Array.isArray(record.steps)) return null
  const steps = record.steps.map(sanitizeStep).filter((step): step is Step => step !== null)
  if (steps.length !== record.steps.length) return null
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Séance"
  const id = typeof record.id === "string" && record.id.trim() ? record.id : crypto.randomUUID()
  const source =
    record.source === "notion" || record.source === "file" || record.source === "local" || record.source === "link"
      ? record.source
      : "local"
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString()
  const notionPageId = typeof record.notionPageId === "string" ? record.notionPageId : undefined
  return { id, name, steps, updatedAt, source, notionPageId }
}

export function parseProgrammationFile(data: unknown): Programmation[] {
  const record = asRecord(data)
  if (!record || record.version !== 1 || !Array.isArray(record.programmations)) {
    throw new Error("Ce fichier n’est pas une programmation Cadence (version 1).")
  }
  if (record.programmations.length === 0) {
    throw new Error("Le fichier ne contient aucune programmation.")
  }
  return record.programmations.map((item, index) => {
    const parsed = sanitizeProgrammation(item)
    if (!parsed) throw new Error(`Programmation ${index + 1} illisible.`)
    return parsed
  })
}

export function serializeProgrammations(programmations: Programmation[]): string {
  return JSON.stringify({ version: 1, programmations }, null, 2)
}

export function mergeProgrammations(current: Programmation[], incoming: Programmation[]): Programmation[] {
  const incomingById = new Map(incoming.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const merged: Programmation[] = []
  for (const item of current) {
    seen.add(item.id)
    merged.push(incomingById.get(item.id) ?? item)
  }
  for (const item of incoming) {
    if (!seen.has(item.id)) merged.push(item)
  }
  return merged
}
