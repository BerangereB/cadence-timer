let context: AudioContext | null = null
const recent = new Map<string, number>()

export function unlockAudio(): void {
  const Ctx = window.AudioContext
  if (!Ctx) return
  if (!context) context = new Ctx()
  if (context.state === "suspended") void context.resume()
}

export function playChime(kind: "warn" | "end"): void {
  if (!context) return
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
