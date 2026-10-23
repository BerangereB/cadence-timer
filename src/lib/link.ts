import { parseStepLine } from "@/lib/duration"
import { mergeProgrammations, type PendingImport, type Programmation, type Step } from "@/lib/programmation"
import { createSession, type Session } from "@/lib/session"
import { type Settings } from "@/lib/storage"

const MAX_HREF = 6000
const MAX_STEPS = 20

export type SessionLink =
  | null
  | { error: string }
  | { programmation: Programmation; settings: Settings }

export type OpenState = {
  programmations: Programmation[]
  settings: Settings
  session: Session
  pending: PendingImport | null
}

function fingerprint(text: string): string {
  let hash = 5381
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    hash = ((hash * 33) ^ code) >>> 0
  }
  return hash.toString(16)
}

function warnAt(raw: string | null): number {
  if (raw == null || !/^\d+$/.test(raw.trim())) return 80
  return Math.min(95, Math.max(50, Number(raw)))
}

function bit(raw: string | null, fallback: boolean): boolean {
  if (raw === "1") return true
  if (raw === "0") return false
  return fallback
}

export function parseSessionLink(href: string): SessionLink {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return { error: "Adresse illisible." }
  }
  if (href.length > MAX_HREF) return { error: "Cette adresse dépasse 6 000 caractères." }

  const rawSteps = url.searchParams.get("etapes")
  if (rawSteps == null) return null

  const segments = rawSteps
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (segments.length === 0) return { error: "Aucune étape dans cette adresse." }
  if (segments.length > MAX_STEPS) return { error: "Vingt étapes au maximum." }

  const steps: Step[] = []
  for (const segment of segments) {
    const parsed = parseStepLine(segment)
    if (!parsed) return { error: `Étape illisible : ${segment}` }
    steps.push({ id: crypto.randomUUID(), name: parsed.name, durationMs: parsed.durationMs })
  }

  const name = url.searchParams.get("titre")?.trim() || "Séance"
  const provided = url.searchParams.get("id")?.trim() ?? ""
  const canonical = `${name}\n${steps.map((step) => `${step.durationMs} ${step.name}\n`).join("")}`
  const id = provided.length >= 1 && provided.length <= 200 ? provided : `link-${fingerprint(canonical)}`

  return {
    programmation: {
      id,
      name,
      steps,
      updatedAt: new Date().toISOString(),
      source: "link",
    },
    settings: {
      warnAtPercent: warnAt(url.searchParams.get("alerte")),
      soundEnabled: bit(url.searchParams.get("son"), true),
      notifySystem: bit(url.searchParams.get("notif"), false),
      autoAdvance: bit(url.searchParams.get("suite"), true),
    },
  }
}

function busy(session: Session): boolean {
  return session.status === "running" || session.status === "paused"
}

export function applySessionLink(state: OpenState & { href: string }): OpenState & { error: string | null } {
  const parsed = parseSessionLink(state.href)
  if (parsed === null) return { ...state, error: null }
  if ("error" in parsed) {
    return {
      programmations: state.programmations,
      settings: state.settings,
      session: state.session,
      pending: state.pending,
      error: parsed.error,
    }
  }
  if (busy(state.session)) {
    return {
      programmations: state.programmations,
      settings: state.settings,
      session: state.session,
      pending: {
        programmations: [parsed.programmation],
        selectId: parsed.programmation.id,
        label: parsed.programmation.name,
        settings: parsed.settings,
      },
      error: null,
    }
  }
  return {
    programmations: mergeProgrammations(state.programmations, [parsed.programmation]),
    settings: parsed.settings,
    session: createSession(parsed.programmation.id),
    pending: null,
    error: null,
  }
}

export function commitPending(
  programmations: Programmation[],
  session: Session,
  settings: Settings,
  pending: PendingImport,
): { programmations: Programmation[]; session: Session; settings: Settings } {
  const merged = mergeProgrammations(programmations, pending.programmations)
  const select =
    pending.selectId && merged.some((item) => item.id === pending.selectId) ? pending.selectId : session.programmationId
  return {
    programmations: merged,
    session: createSession(select),
    settings: pending.settings ?? settings,
  }
}
