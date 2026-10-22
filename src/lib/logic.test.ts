import { describe, expect, it } from "vitest"
import { formatClock, parseStepLine } from "./duration"
import {
  parseNotionPageId,
  stepsFromDatabasePages,
  collectSteps,
  type NotionBlock,
  type NotionDatabasePage,
} from "./notion"
import { mergeProgrammations, parseProgrammationFile, type Programmation } from "./programmation"
import { advance, createSession, elapsedNow, pause, play } from "./session"

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

describe("fichier et Notion", () => {
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

  it("extrait l’identifiant de page", () => {
    expect(parseNotionPageId("https://www.notion.so/Seance-1429989fe25d4b4f9b0b0b0b0b0b0b0b?pvs=21")).toBe(
      "1429989fe25d4b4f9b0b0b0b0b0b0b0b",
    )
    expect(parseNotionPageId("pas une page")).toBeNull()
  })

  it("lit une base et une liste", async () => {
    const pages: NotionDatabasePage[] = [
      { properties: { Nom: { type: "title", title: [{ plain_text: "Suite" }] }, Ordre: { type: "number", number: 2 }, Durée: { type: "number", number: 10 } } },
      { properties: { Nom: { type: "title", title: [{ plain_text: "Intro" }] }, Ordre: { type: "number", number: 1 }, Durée: { type: "number", number: 5 } } },
    ]
    expect(stepsFromDatabasePages(pages).map((step) => step.name)).toEqual(["Intro", "Suite"])

    const blocks: NotionBlock[] = [
      { id: "1", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "5 min — Pause" }] } },
      { id: "db", type: "child_database" },
    ]
    const steps = await collectSteps(
      "root",
      async () => blocks,
      async () => pages,
    )
    expect(steps.map((step) => step.name)).toEqual(["Pause", "Intro", "Suite"])
  })
})
