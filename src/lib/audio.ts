type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

let context: AudioContext | null = null
const recent = new Map<string, number>()

function audioContextCtor(): typeof AudioContext | undefined {
  const win = window as AudioWindow
  return win.AudioContext ?? win.webkitAudioContext
}

function ensureContext(): AudioContext | null {
  const Ctx = audioContextCtor()
  if (!Ctx) return null
  if (!context) context = new Ctx()
  return context
}

function playSilentUnlock(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // déblocage silencieux indisponible
  }
}

export function unlockAudio(): void {
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state === "suspended") void ctx.resume()
  playSilentUnlock(ctx)
}

/** Reprend un contexte déjà débloqué (ex. retour d’arrière-plan). */
export function resumeAudio(): void {
  if (!context) return
  if (context.state === "suspended") void context.resume()
}

export function playChime(kind: "warn" | "end"): void {
  if (!context) return
  if (context.state === "suspended") void context.resume()
  const start = context.currentTime
  const notes = kind === "warn" ? [523.25] : [392, 523.25]
  for (const [index, freq] of notes.entries()) {
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, start)
    const when = start + index * 0.16
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(0.04, when + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3)
    osc.connect(gain)
    gain.connect(context.destination)
    osc.start(when)
    osc.stop(when + 0.32)
  }
}

export function claimAlert(key: string, now = Date.now()): boolean {
  const prev = recent.get(key)
  if (prev != null && now - prev < 1200) return false
  recent.set(key, now)
  return true
}

export function pulse(kind: "warn" | "end"): void {
  try {
    navigator.vibrate?.(kind === "warn" ? 12 : [10, 40, 10])
  } catch {
    // vibration indisponible
  }
}
