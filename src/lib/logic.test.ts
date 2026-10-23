import { describe, expect, it, vi } from "vitest"
import { formatClock, parseStepLine } from "./duration"
import { mergeProgrammations, parseProgrammationFile, sanitizeProgrammation, type Programmation } from "./programmation"
import { advance, createSession, elapsedNow, pause, play } from "./session"
import { loadPending, loadSettings, savePending, saveSettings } from "./storage"

describe("durées", () => {
  it("lit les formats de séance", () => {
    expect(parseStepLine("25 min — Travail profond")).toEqual({ durationMs: 1_500_000, name: "Travail profond" })
    expect(parseStepLine("5 min — Pause")).toEqual({ durationMs: 300_000, name: "Pause" })
    expect(parseStepLine("1 h 30 — Bilan")).toEqual({ durationMs: 5_400_000, name: "Bilan" })
    expect(parseStepLine("1h30 — Bilan")).toEqual({ durationMs: 5_400_000, name: "Bilan" })
    expect(parseStepLine("00:45 — Souffle")).toEqual({ durationMs: 45_000, name: "Souffle" })
    expect(parseStepLine("10 — Nom")).toEqual({ durationMs: 600_000, name: "Nom" })
    expect(parseStepLine("bonjour")).toBeNull()
  })

  it("affiche l’horloge", () => {
    expect(formatClock(90_000)).toBe("01:30")
    expect(formatClock(5_400_000)).toBe("1:30:00")
    expect(formatClock(0)).toBe("00:00")
  })
})

describe("minuteur", () => {
  const steps = [
    { name: "A", durationMs: 10_000 },
    { name: "B", durationMs: 10_000 },
    { name: "C", durationMs: 10_000 },
  ]

  it("prévient une seule fois à 80 %", () => {
    const started = { ...createSession("p"), status: "running" as const, runStartedAt: 0, elapsedMs: 0 }
    const early = advance(started, steps, 7_000, { warnAtPercent: 80, autoAdvance: true })
    expect(early.alert).toBeNull()
    expect(early.session).toBe(started)
    const warn = advance(started, steps, 8_000, { warnAtPercent: 80, autoAdvance: true })
    expect(warn.alert).toBe("warn")
    expect(warn.alertStepName).toBe("A")
    const again = advance(warn.session, steps, 8_500, { warnAtPercent: 80, autoAdvance: true })
    expect(again.alert).toBeNull()
    expect(again.session).toBe(warn.session)
  })

  it("enchaîne puis s’arrête à la fin", () => {
    const started = { ...createSession("p"), status: "running" as const, runStartedAt: 0 }
    const next = advance(started, steps, 10_000, { warnAtPercent: 80, autoAdvance: true })
    expect(next.alert).toBe("end")
    expect(next.session.stepIndex).toBe(1)
    expect(next.session.status).toBe("running")
    const done = advance({ ...started, stepIndex: 2 }, steps, 10_000, { warnAtPercent: 80, autoAdvance: true })
    expect(done.session.status).toBe("done")
    const held = advance(started, steps, 10_000, { warnAtPercent: 80, autoAdvance: false })
    expect(held.session.status).toBe("paused")
    expect(held.session.ended).toBe(true)
  })

  it("rattrape plusieurs étapes sans multiplier les alertes", () => {
    const started = { ...createSession("p"), status: "running" as const, runStartedAt: 0 }
    const landed = advance(started, steps, 25_000, { warnAtPercent: 80, autoAdvance: true })
    expect(landed.alert).toBe("end")
    expect(landed.alertStepName).toBe("2 étapes terminées")
    expect(landed.session.stepIndex).toBe(2)
    expect(landed.session.elapsedMs).toBe(5_000)
    expect(elapsedNow(landed.session, 25_000)).toBe(5_000)
  })

  it("reprend après une pause", () => {
    const running = { ...createSession("p"), status: "running" as const, runStartedAt: 1_000, elapsedMs: 2_000 }
    const held = pause(running, 4_000)
    expect(held.elapsedMs).toBe(5_000)
    expect(held.status).toBe("paused")
    const resumed = play(held, steps, 9_000)
    expect(resumed.status).toBe("running")
    expect(resumed.elapsedMs).toBe(5_000)
    expect(elapsedNow(resumed, 10_000)).toBe(6_000)
  })
})

describe("fichier", () => {
  it("fusionne par identifiant", () => {
    const current: Programmation[] = [
      { id: "a", name: "A", steps: [], updatedAt: "1", source: "local" },
    ]
    const incoming: Programmation[] = [
      { id: "a", name: "A2", steps: [], updatedAt: "2", source: "file" },
      { id: "b", name: "B", steps: [], updatedAt: "2", source: "file" },
    ]
    expect(mergeProgrammations(current, incoming).map((item) => item.name)).toEqual(["A2", "B"])
  })

  it("refuse un fichier inconnu", () => {
    expect(() => parseProgrammationFile({ version: 2 })).toThrow(/version 1/)
  })

  it("relit une séance Notion et une séance lien", () => {
    const notion = sanitizeProgrammation({ id: "n", name: "Ancienne", steps: [{ name: "A", durationMs: 1000 }], source: "notion", notionPageId: "page" })
    expect(notion?.source).toBe("notion")
    expect(notion?.notionPageId).toBe("page")
    expect(sanitizeProgrammation({ id: "l", name: "Lien", steps: [{ name: "A", durationMs: 1000 }], source: "link" })?.source).toBe("link")
    expect(sanitizeProgrammation({ id: "x", name: "Inconnue", steps: [{ name: "A", durationMs: 1000 }], source: "autre" })?.source).toBe("local")
  })

  it("n’enregistre plus le jeton Notion", () => {
    const memory = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    })
    memory.set(
      "cadence.settings.v1",
      JSON.stringify({
        warnAtPercent: 70,
        soundEnabled: false,
        notifySystem: true,
        autoAdvance: false,
        notionToken: "secret",
        notionPageUrl: "https://www.notion.so/x",
        autoImport: true,
      }),
    )
    const loaded = loadSettings()
    expect(loaded).toEqual({ warnAtPercent: 70, soundEnabled: false, notifySystem: true, autoAdvance: false })
    saveSettings(loaded)
    expect(JSON.parse(memory.get("cadence.settings.v1") ?? "{}")).not.toHaveProperty("notionToken")
    savePending({
      programmations: [{ id: "lien", name: "Lien", steps: [{ id: "s", name: "A", durationMs: 1000 }], updatedAt: "1", source: "link" }],
      selectId: "lien",
      label: "Lien",
      settings: loaded,
    })
    expect(loadPending()?.settings).toEqual(loaded)
    vi.unstubAllGlobals()
  })
})
