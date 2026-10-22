import { parseStepLine } from "@/lib/duration"
import type { Programmation, Step } from "@/lib/programmation"

export type NotionRichText = { plain_text?: string }

export type NotionProperty = {
  type?: string
  title?: NotionRichText[]
  rich_text?: NotionRichText[]
  number?: number | null
}

export type NotionBlock = {
  id: string
  type: string
  has_children?: boolean
  archived?: boolean
  [key: string]: unknown
}

export type NotionDatabasePage = {
  archived?: boolean
  properties?: Record<string, NotionProperty>
}

export type StepDraft = { name: string; durationMs: number; note?: string }

const NOTION_VERSION = "2022-06-28"

export class NotionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotionError"
  }
}

export function richToPlain(rich: NotionRichText[] | undefined): string {
  if (!rich) return ""
  return rich.map((part) => part.plain_text ?? "").join("").replace(/\s+/g, " ").trim()
}

export function parseNotionPageId(input: string): string | null {
  let raw = input.trim()
  if (!raw) return null
  if (!raw.startsWith("http") && raw.includes("notion.")) raw = `https://${raw}`
  try {
    if (raw.startsWith("http")) raw = new URL(raw).pathname
  } catch {
    // texte brut
  }
  raw = (raw.split("?")[0]?.split("#")[0] ?? raw).replace(/\/$/, "")
  const dashed = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
  if (dashed?.[1]) return dashed[1].replace(/-/g, "").toLowerCase()
  const compact = raw.match(/([0-9a-f]{32})$/i)
  return compact?.[1]?.toLowerCase() ?? null
}

export function readPageParam(search = typeof window === "undefined" ? "" : window.location.search): string {
  return new URLSearchParams(search).get("page")?.trim() ?? ""
}

function norm(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

function findProperty(props: Record<string, NotionProperty>, keys: string[]): NotionProperty | undefined {
  const entries = Object.entries(props).map(([name, prop]) => ({ name: norm(name), prop }))
  for (const key of keys) {
    const exact = entries.find((entry) => entry.name === key)
    if (exact) return exact.prop
  }
  for (const key of keys) {
    const loose = entries.find((entry) => entry.name.startsWith(key))
    if (loose) return loose.prop
  }
  return undefined
}

export function titleFromProperties(props: Record<string, NotionProperty> | undefined): string {
  if (!props) return ""
  for (const prop of Object.values(props)) {
    if (prop.type === "title") {
      const text = richToPlain(prop.title)
      if (text) return text
    }
  }
  return ""
}

export function stepsFromDatabasePages(pages: NotionDatabasePage[]): StepDraft[] {
  const rows = pages.flatMap((page) => {
    if (page.archived) return []
    const props = page.properties ?? {}
    const name = titleFromProperties(props)
    const durationProp = findProperty(props, ["duree", "minutes", "minute", "duration", "temps"])
    const minutes = durationProp?.type === "number" ? durationProp.number : null
    if (!name || minutes == null || !Number.isFinite(minutes) || minutes <= 0) return []
    const noteProp = findProperty(props, ["notes", "note"])
    const note = noteProp?.type === "rich_text" ? richToPlain(noteProp.rich_text) : ""
    const orderProp = findProperty(props, ["ordre", "order"])
    const order = orderProp?.type === "number" && orderProp.number != null ? orderProp.number : null
    return [{ name, durationMs: Math.round(minutes * 60_000), note: note || undefined, order }]
  })
  if (rows.some((row) => row.order != null)) {
    rows.sort((a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY))
  }
  return rows.map(({ order: _order, ...draft }) => draft)
}

function plainFromBlock(block: NotionBlock): string {
  const value = block[block.type]
  if (!value || typeof value !== "object") return ""
  return richToPlain((value as { rich_text?: NotionRichText[] }).rich_text)
}

const CONTAINERS = new Set([
  "column_list",
  "column",
  "toggle",
  "synced_block",
  "quote",
  "callout",
  "heading_1",
  "heading_2",
  "heading_3",
])

export async function collectSteps(
  rootId: string,
  loadChildren: (id: string) => Promise<NotionBlock[]>,
  loadDatabase: (id: string) => Promise<NotionDatabasePage[]>,
): Promise<StepDraft[]> {
  async function walk(id: string, depth: number): Promise<StepDraft[]> {
    if (depth > 6) return []
    const blocks = await loadChildren(id)
    const steps: StepDraft[] = []
    for (const block of blocks) {
      if (block.archived) continue
      if (block.type === "bulleted_list_item" || block.type === "numbered_list_item" || block.type === "to_do") {
        const parsed = parseStepLine(plainFromBlock(block))
        if (parsed) {
          steps.push(parsed)
          continue
        }
        if (block.has_children) steps.push(...(await walk(block.id, depth + 1)))
        continue
      }
      if (block.type === "child_database") {
        steps.push(...stepsFromDatabasePages(await loadDatabase(block.id)))
        continue
      }
      if (block.has_children && CONTAINERS.has(block.type)) {
        steps.push(...(await walk(block.id, depth + 1)))
      }
    }
    return steps
  }
  return walk(rootId, 0)
}

function draftsToSteps(drafts: StepDraft[]): Step[] {
  return drafts.map((draft) => ({
    id: crypto.randomUUID(),
    name: draft.name,
    durationMs: draft.durationMs,
    note: draft.note,
  }))
}

async function notionFetch(token: string, path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    }
    if (init?.body) headers["Content-Type"] = "application/json"
    response = await fetch(`https://api.notion.com/v1${path}`, { ...init, headers })
  } catch {
    throw new NotionError("Impossible de joindre Notion. Vérifiez la connexion.")
  }
  if (response.status === 401) throw new NotionError("Jeton refusé. Vérifiez le jeton d’intégration.")
  if (response.status === 403 || response.status === 404) {
    throw new NotionError("Page introuvable ou non partagée avec l’intégration.")
  }
  if (!response.ok) {
    let detail = ""
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) detail = ` ${body.message}`
    } catch {
      // corps illisible
    }
    throw new NotionError(`Notion a répondu ${response.status}.${detail}`)
  }
  return response.json()
}

async function listAll(token: string, path: string, method: "GET" | "POST" = "GET"): Promise<unknown[]> {
  const results: unknown[] = []
  let cursor: string | undefined
  do {
    const url = new URL(`https://api.notion.com${path.startsWith("/v1") ? path : `/v1${path}`}`)
    if (method === "GET" && cursor) url.searchParams.set("start_cursor", cursor)
    if (method === "GET") url.searchParams.set("page_size", "100")
    const body = method === "POST" ? JSON.stringify({ page_size: 100, start_cursor: cursor }) : undefined
    const data = (await notionFetch(token, `${url.pathname.replace("/v1", "")}${url.search}`, {
      method,
      body,
    })) as { results?: unknown[]; has_more?: boolean; next_cursor?: string | null }
    results.push(...(data.results ?? []))
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)
  return results
}

export async function importProgrammationFromNotion(token: string, pageRef: string): Promise<Programmation> {
  const pageId = parseNotionPageId(pageRef)
  if (!pageId) throw new NotionError("Adresse Notion invalide. Collez le lien de la page.")

  let title = ""
  let drafts: StepDraft[] = []

  try {
    const page = (await notionFetch(token, `/pages/${pageId}`)) as {
      properties?: Record<string, NotionProperty>
    }
    title = titleFromProperties(page.properties)
    drafts = await collectSteps(
      pageId,
      async (id) => (await listAll(token, `/blocks/${id}/children`)) as NotionBlock[],
      async (id) => (await listAll(token, `/databases/${id}/query`, "POST")) as NotionDatabasePage[],
    )
  } catch (error) {
    if (!(error instanceof NotionError) || !error.message.includes("introuvable")) throw error
    const database = (await notionFetch(token, `/databases/${pageId}`)) as { title?: NotionRichText[] }
    title = richToPlain(database.title)
    drafts = stepsFromDatabasePages(
      (await listAll(token, `/databases/${pageId}/query`, "POST")) as NotionDatabasePage[],
    )
  }

  if (drafts.length === 0) {
    throw new NotionError("Aucune étape reconnue. Utilisez une liste « 25 min — Nom » ou une base avec une colonne Durée.")
  }

  return {
    id: `notion-${pageId}`,
    name: title || "Programmation Notion",
    steps: draftsToSteps(drafts),
    updatedAt: new Date().toISOString(),
    source: "notion",
    notionPageId: pageId,
  }
}
