const SEP = String.raw`(?:—|–|-|\|)`

const PATTERNS: { re: RegExp; ms: (match: RegExpMatchArray) => number }[] = [
  {
    re: new RegExp(String.raw`^(\d+)\s*h(?:\s*(\d+))?(?:\s*(?:min|mn|m))?\s*${SEP}\s*(.+)$`, "i"),
    ms: (m) => (Number(m[1]) * 60 + Number(m[2] ?? 0)) * 60_000,
  },
  {
    re: new RegExp(String.raw`^(\d+):(\d{2}):(\d{2})\s*${SEP}\s*(.+)$`),
    ms: (m) => (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000,
  },
  {
    re: new RegExp(String.raw`^(\d+):(\d{2})\s*${SEP}\s*(.+)$`),
    ms: (m) => (Number(m[1]) * 60 + Number(m[2])) * 1000,
  },
  {
    re: new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|secondes?)\s*${SEP}\s*(.+)$`, "i"),
    ms: (m) => Math.round(Number(m[1].replace(",", ".")) * 1000),
  },
  {
    re: new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*(?:min|mn|m)\s*${SEP}\s*(.+)$`, "i"),
    ms: (m) => Math.round(Number(m[1].replace(",", ".")) * 60_000),
  },
  {
    re: new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*${SEP}\s*(.+)$`),
    ms: (m) => Math.round(Number(m[1].replace(",", ".")) * 60_000),
  },
]

const MAX_MS = 24 * 60 * 60 * 1000

export function parseStepLine(line: string): { durationMs: number; name: string } | null {
  const text = line.replace(/\s+/g, " ").trim()
  for (const pattern of PATTERNS) {
    const match = text.match(pattern.re)
    if (!match) continue
    const durationMs = pattern.ms(match)
    const name = match[match.length - 1]?.trim() ?? ""
    if (!name || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_MS) return null
    return { durationMs, name }
  }
  return null
}

export function formatClock(ms: number): string {
  const safe = Math.max(0, ms)
  const totalSeconds = safe === 0 ? 0 : Math.ceil(safe / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export function formatLoose(ms: number): string {
  const safe = Math.max(0, Math.round(ms / 1000))
  if (safe < 60) return `${safe} s`
  const minutes = Math.round(safe / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${minutes} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest}`
}

export function formatSpoken(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts: string[] = []
  if (hours) parts.push(`${hours} heure${hours > 1 ? "s" : ""}`)
  if (minutes) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`)
  if (seconds || parts.length === 0) parts.push(`${seconds} seconde${seconds > 1 ? "s" : ""}`)
  return parts.join(" ")
}

export function clampDuration(minutes: number, seconds: number): number {
  const ms = (Math.max(0, minutes) * 60 + Math.max(0, Math.min(59, seconds))) * 1000
  return Math.min(MAX_MS, Math.max(1000, ms))
}
