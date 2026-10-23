# Lien de séance — plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ouvrir une séance et ses réglages depuis une URL GET, et retirer l’appel à l’API Notion.

**Architecture:** `parseSessionLink` lit l’adresse. `applySessionLink` décide si la séance s’applique tout de suite ou attend la remise à zéro. Le minuteur appelle ces fonctions au chargement. Le dialogue de réglages ne parle plus à Notion.

**Tech Stack:** Vite, React, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-lien-seance-design.md`

## Global Constraints

- Vingt étapes maximum. Adresse de plus de 6 000 caractères refusée. 6 000 passe.
- Messages exacts : « Adresse illisible. », « Cette adresse dépasse 6 000 caractères. », « Aucune étape dans cette adresse. », « Vingt étapes au maximum. », « Étape illisible : » + segment trimé.
- Défauts : titre « Séance », alerte 80, son actif, notification inactive, enchaînement actif.
- `alerte` hors 50–95 est ramené dans l’intervalle. Toute autre valeur de `son`, `notif`, `suite` prend le défaut.
- Sans `etapes`, et sous 6 001 caractères, aucun changement.
- Identifiant fourni conservé s’il fait 1 à 200 caractères. Sinon `link-` + djb2 (graine 5381, `h = ((h * 33) xor code) >>> 0`).
- Séance lien : `source: "link"`, pas de `notionPageId`.
- Minuteur en lecture ou en pause : séance et réglages attendent la remise à zéro dans `PendingImport.settings`.
- Minuteur à l’arrêt ou terminé : fusion, sélection, remise à zéro, réglages remplacés, attente effacée.
- La lecture ne démarre pas toute seule.
- `source: "notion"` et `notionPageId` restent lisibles. Le jeton n’est plus réécrit.

## Review Focus

- Une adresse trop longue sans `etapes` est refusée avant d’être ignorée.
- Un `|` encodé `%7C` sépare quand même les étapes.
- Réouvrir le même `id` remplace la séance et n’en ajoute pas une seconde.
- Un import de fichier en attente ne porte pas de réglages : la remise à zéro ne les change pas.
- Une séance déjà stockée avec `source: "notion"` se charge encore.

### Task 1: Lecture de l’URL

**Files:**
- Create: `src/lib/link.ts`
- Test: `src/lib/link.test.ts`

**Interfaces:**
- Produces: `parseSessionLink(href: string): null | { error: string } | { programmation: Programmation; settings: Settings }`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `npm test -- src/lib/link.test.ts` and see it fail**
- [ ] **Step 3: Implement `parseSessionLink`**
- [ ] **Step 4: Run the test and see it pass**

### Task 2: Application et retrait de Notion

**Files:**
- Modify: `src/lib/link.ts`, `src/lib/programmation.ts`, `src/lib/storage.ts`, `src/hooks/useTimer.ts`, `src/App.tsx`, `src/components/SettingsDialog.tsx`, `src/lib/logic.test.ts`, `README.md`
- Delete: `src/lib/notion.ts`

**Interfaces:**
- Consumes: `parseSessionLink`
- Produces: `applySessionLink`, `commitPending`

- [ ] **Step 1: Tests for apply, commit, stored Notion settings, and old `notion` source**
- [ ] **Step 2: Run them and see them fail**
- [ ] **Step 3: Implement application, drop the Notion client and its UI**
- [ ] **Step 4: `npm test` passes**
- [ ] **Step 5: Open an example URL and an invalid URL in the browser**
