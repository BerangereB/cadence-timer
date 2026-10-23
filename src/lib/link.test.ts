import { describe, expect, it } from "vitest"
import { applySessionLink, commitPending, parseSessionLink } from "./link"
import { createSession } from "./session"
import { defaultSettings, type Settings } from "./storage"
import type { PendingImport, Programmation } from "./programmation"

const base = "https://cadence.local/"

function href(query: string): string {
  return `${base}?${query}`
}

function ofLength(length: number): string {
  const tail = `&etapes=${encodeURIComponent("5 min — A")}`
  const head = `${base}?p=`
  return head + "a".repeat(length - head.length - tail.length) + tail
}

describe("parseSessionLink", () => {
  it("lit une séance complète", () => {
    const parsed = parseSessionLink(
      href("titre=S%C3%A9ance&alerte=70&son=0&notif=1&suite=0&id=abc&etapes=5%20min%20%E2%80%94%20Rappel%7C40%20min%20%E2%80%94%20Travail"),
    )
    expect(parsed).toMatchObject({
      settings: { warnAtPercent: 70, soundEnabled: false, notifySystem: true, autoAdvance: false },
      programmation: {
        id: "abc",
        name: "Séance",
        source: "link",
        steps: [
          { name: "Rappel", durationMs: 300_000 },
          { name: "Travail", durationMs: 2_400_000 },
        ],
      },
    })
    if (parsed && "programmation" in parsed) {
      expect(parsed.programmation.notionPageId).toBeUndefined()
      expect(parsed.programmation.steps.every((step) => step.note === undefined)).toBe(true)
    }
  })

  it("accepte vingt étapes et refuse la vingt-et-unième", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => `${index + 1} min — E${index}`).join("|")
    const twentyOne = `${twenty}|21 min — E20`
    expect(parseSessionLink(href(`etapes=${encodeURIComponent(twenty)}`))).toMatchObject({
      programmation: { steps: expect.any(Array) },
    })
    const tooMany = parseSessionLink(href(`etapes=${encodeURIComponent(twentyOne)}`))
    expect(tooMany).toEqual({ error: "Vingt étapes au maximum." })
  })

  it("refuse 6 001 caractères et accepte 6 000", () => {
    expect(ofLength(6000)).toHaveLength(6000)
    expect(ofLength(6001)).toHaveLength(6001)
    expect(parseSessionLink(ofLength(6001))).toEqual({ error: "Cette adresse dépasse 6 000 caractères." })
    expect(parseSessionLink(ofLength(6000))).toMatchObject({
      programmation: { steps: [{ name: "A", durationMs: 300_000 }] },
    })
  })

  it("refuse une adresse qui n’est pas absolue, même très longue", () => {
    expect(parseSessionLink("pas une url")).toEqual({ error: "Adresse illisible." })
    expect(parseSessionLink(`pas une url ${"x".repeat(6000)}`)).toEqual({ error: "Adresse illisible." })
  })

  it("cite le segment illisible et refuse toute la séance", () => {
    expect(parseSessionLink(href("etapes=5%20min%20%E2%80%94%20Ok%7Cbonjour"))).toEqual({
      error: "Étape illisible : bonjour",
    })
  })

  it("refuse des étapes vides", () => {
    expect(parseSessionLink(href("etapes="))).toEqual({ error: "Aucune étape dans cette adresse." })
    expect(parseSessionLink(href("etapes=%20%7C%20"))).toEqual({ error: "Aucune étape dans cette adresse." })
  })

  it("ignore la query string quand etapes est absent", () => {
    expect(parseSessionLink(href("titre=X&alerte=50&son=0"))).toBeNull()
  })

  it("décode les espaces, le plus et perluète", () => {
    const parsed = parseSessionLink(href(`etapes=${encodeURIComponent("5 min — Rappel & Suite")}`))
    expect(parsed).toMatchObject({ programmation: { steps: [{ name: "Rappel & Suite", durationMs: 300_000 }] } })
    const plus = parseSessionLink(href("etapes=5+min+%E2%80%94+Pause"))
    expect(plus).toMatchObject({ programmation: { steps: [{ name: "Pause", durationMs: 300_000 }] } })
  })

  it("normalise l’alerte", () => {
    expect(parseSessionLink(href("etapes=5+min+%E2%80%94+A"))).toMatchObject({ settings: { warnAtPercent: 80 } })
    expect(parseSessionLink(href("alerte=abc&etapes=5+min+%E2%80%94+A"))).toMatchObject({ settings: { warnAtPercent: 80 } })
    expect(parseSessionLink(href("alerte=40&etapes=5+min+%E2%80%94+A"))).toMatchObject({ settings: { warnAtPercent: 50 } })
    expect(parseSessionLink(href("alerte=99&etapes=5+min+%E2%80%94+A"))).toMatchObject({ settings: { warnAtPercent: 95 } })
  })

  it("prend le défaut pour son, notif et suite hors 0 ou 1", () => {
    const loose = parseSessionLink(href("son=2&notif=2&suite=oui&etapes=5+min+%E2%80%94+A"))
    expect(loose).toMatchObject({ settings: { soundEnabled: true, notifySystem: false, autoAdvance: true } })
    const off = parseSessionLink(href("son=0&suite=0&notif=1&etapes=5+min+%E2%80%94+A"))
    expect(off).toMatchObject({ settings: { soundEnabled: false, notifySystem: true, autoAdvance: false } })
  })

  it("garde la première valeur d’un paramètre répété", () => {
    expect(parseSessionLink(href("son=0&son=1&etapes=5+min+%E2%80%94+A"))).toMatchObject({
      settings: { soundEnabled: false },
    })
  })

  it("calcule un identifiant stable et conserve un id fourni", () => {
    const same = href("titre=S%C3%A9ance&etapes=5%20min%20%E2%80%94%20Rappel")
    const first = parseSessionLink(same)
    const second = parseSessionLink(same)
    const other = parseSessionLink(href("titre=Autre&etapes=5%20min%20%E2%80%94%20Rappel"))
    expect(first && "programmation" in first && first.programmation.id).toBe("link-f37d09cf")
    expect(second && "programmation" in second && second.programmation.id).toBe("link-f37d09cf")
    expect(other && "programmation" in other && other.programmation.id).not.toBe("link-f37d09cf")
    expect(parseSessionLink(href("id=page-notion&etapes=5+min+%E2%80%94+A"))).toMatchObject({
      programmation: { id: "page-notion" },
    })
    expect(parseSessionLink(href(`id=${"a".repeat(201)}&titre=S%C3%A9ance&etapes=5%20min%20%E2%80%94%20Rappel`))).toMatchObject({
      programmation: { id: "link-f37d09cf" },
    })
  })
})

function programmation(id: string, name: string): Programmation {
  return { id, name, steps: [{ id: "s", name: "Ancien", durationMs: 60_000 }], updatedAt: "1", source: "local" }
}

function settings(over: Partial<Settings> = {}): Settings {
  return { ...defaultSettings, ...over }
}

describe("applySessionLink", () => {
  it("remplace la séance arrêtée et efface l’attente", () => {
    const pending: PendingImport = { programmations: [programmation("file", "Fichier")], selectId: "file", label: "Fichier" }
    const opened = applySessionLink({
      programmations: [programmation("abc", "Ancien nom")],
      settings: settings({ soundEnabled: true }),
      session: { ...createSession("abc"), status: "done" },
      pending,
      href: href("id=abc&son=0&etapes=10%20min%20%E2%80%94%20Nouveau"),
    })
    expect(opened.error).toBeNull()
    expect(opened.pending).toBeNull()
    expect(opened.settings.soundEnabled).toBe(false)
    expect(opened.session).toMatchObject({ programmationId: "abc", status: "idle", stepIndex: 0 })
    expect(opened.programmations).toHaveLength(1)
    expect(opened.programmations[0]).toMatchObject({
      id: "abc",
      name: "Séance",
      source: "link",
      steps: [{ name: "Nouveau", durationMs: 600_000 }],
    })
  })

  it("met la séance et les réglages en attente pendant la lecture", () => {
    const current = [programmation("local", "Locale")]
    const currentSettings = settings({ warnAtPercent: 90 })
    const running = { ...createSession("local"), status: "running" as const, runStartedAt: 1 }
    const opened = applySessionLink({
      programmations: current,
      settings: currentSettings,
      session: running,
      pending: { programmations: [programmation("file", "Fichier")], selectId: "file", label: "Fichier" },
      href: href("id=lien&alerte=60&etapes=5%20min%20%E2%80%94%20Arrivée"),
    })
    expect(opened.programmations).toBe(current)
    expect(opened.settings).toBe(currentSettings)
    expect(opened.session).toBe(running)
    expect(opened.pending?.settings?.warnAtPercent).toBe(60)
    expect(opened.pending?.programmations[0]).toMatchObject({ id: "lien", name: "Séance" })
  })

  it("ne change rien sur une erreur ou sans étapes", () => {
    const input = {
      programmations: [programmation("local", "Locale")],
      settings: settings(),
      session: createSession("local"),
      pending: null,
    }
    const invalid = applySessionLink({ ...input, href: href("etapes=bonjour") })
    expect(invalid.programmations).toBe(input.programmations)
    expect(invalid.settings).toBe(input.settings)
    expect(invalid.session).toBe(input.session)
    expect(invalid.error).toBe("Étape illisible : bonjour")
    const absent = applySessionLink({ ...input, href: base })
    expect(absent.error).toBeNull()
    expect(absent.programmations).toBe(input.programmations)
  })
})

describe("commitPending", () => {
  it("applique les réglages du lien et laisse ceux d’un fichier", () => {
    const withSettings = commitPending(
      [programmation("local", "Locale")],
      createSession("local"),
      settings({ soundEnabled: true }),
      {
        programmations: [programmation("lien", "Lien")],
        selectId: "lien",
        label: "Lien",
        settings: settings({ soundEnabled: false, warnAtPercent: 55 }),
      },
    )
    expect(withSettings.settings.soundEnabled).toBe(false)
    expect(withSettings.session.programmationId).toBe("lien")
    const file = commitPending(
      [programmation("local", "Locale")],
      createSession("local"),
      settings({ soundEnabled: true }),
      { programmations: [programmation("file", "Fichier")], selectId: "file", label: "Fichier" },
    )
    expect(file.settings.soundEnabled).toBe(true)
  })
})
