# Lien de séance

Cadence n’appelle plus l’API Notion. Une séance et ses réglages arrivent dans la query string d’une URL GET. La formule du modèle Notion, tenue à jour hors de ce dépôt, fabrique cette URL et l’affiche comme un lien « Démarrer ».

## Contrat d’URL

Exemple :

```text
https://hôte/cadence/?titre=Séance&alerte=80&son=1&notif=0&suite=1&id=page-notion&etapes=5%20min%20—%20Rappel|40%20min%20—%20Travail
```

Seul le query string compte. Le fragment est ignoré. Si un paramètre est répété, la première valeur gagne.

| Paramètre | Rôle |
|---|---|
| `etapes` | Étapes séparées par `\|`, après décodage. Chaque segment suit les formats déjà reconnus par `parseStepLine` : `5 min — Nom`, `1 h 30 — Bilan`, `00:45 — Souffle`, `10 — Nom`. |
| `titre` | Nom de la séance. Vide ou absent : « Séance ». |
| `alerte` | Seuil d’alerte, entier. Absent ou illisible : 80. En dehors de 50–95 : ramené dans cet intervalle. |
| `son` | `1` actif, `0` inactif. Absent, ou toute autre valeur : actif. |
| `notif` | `1` ou `0`. Absent, ou toute autre valeur : inactif. L’autorisation du navigateur reste demandée par le réglage dans Cadence. |
| `suite` | Enchaîner les étapes. `1` ou `0`. Absent, ou toute autre valeur : actif. |
| `id` | Identifiant stable, 1 à 200 caractères après trim. Réouvrir le même lien remplace cette séance. Absent, vide, ou plus long : identifiant calculé. |

Les espaces peuvent s’écrire `%20` ou `+`. Dans un nom, encoder `&` (`%26`), `=` (`%3D`), `%` (`%25`), `#` (`%23`) et `+` (`%2B`). Après décodage, `|` sépare toujours les étapes : un nom d’étape ne contient pas ce caractère. `%7C` devient `|` et sépare aussi.

Une visite dont `etapes` est valide définit les quatre réglages en entier. Un paramètre de réglage absent prend le défaut ci-dessus, y compris si le navigateur avait une autre valeur enregistrée.

Sans paramètre `etapes`, et tant que l’adresse ne dépasse pas 6 000 caractères, Cadence ignore le reste de la query string et s’ouvre sur les séances déjà enregistrées.

## Lecture

`parseSessionLink(href)` dans `src/lib/link.ts` retourne l’un des trois résultats suivants, dans cet ordre. La longueur est celle de `href` : 6 000 caractères passent, 6 001 sont refusés.

1. Une erreur si `href` n’est pas une URL absolue : « Adresse illisible. »
2. Une erreur si `href` dépasse 6 000 caractères : « Cette adresse dépasse 6 000 caractères. »
3. `null` si `etapes` est absent. Aucun changement.
4. Une erreur, et ni la séance ni les réglages ne changent :
   - après split sur `|`, trim, et suppression des segments vides, il ne reste rien : « Aucune étape dans cette adresse. »
   - plus de 20 segments : « Vingt étapes au maximum. »
   - un segment que `parseStepLine` refuse : « Étape illisible : » suivi du segment trimé.
5. Une séance et les quatre réglages.

Les étapes n’ont pas de note. L’ordre est celui des segments.

L’identifiant calculé est `link-` suivi de l’empreinte djb2 en hexadécimal, sur 32 bits non signés, de la chaîne `titre trimé`, un saut de ligne, puis chaque étape `durationMs`, une espace, le nom, un saut de ligne. La graine est 5381 et chaque point de code fait `h = ((h * 33) xor code) >>> 0`. Deux contenus identiques donnent le même identifiant. Un contenu modifié en donne un autre ; l’ancienne séance reste dans la liste.

La séance enregistrée a `source: "link"`, `updatedAt` au moment de la lecture, et pas de `notionPageId`.

## Application à l’ouverture

Au chargement, Cadence appelle `parseSessionLink(window.location.href)` une fois.

- Erreur : le message s’affiche sous l’en-tête, à la place de l’ancien statut Notion, avec `role="alert"`. Il n’est pas mémorisé.
- Succès, minuteur à l’arrêt ou terminé : fusion par identifiant, sélection de cette séance, remise à la première étape, minutage arrêté. Les quatre réglages remplacent ceux du navigateur et sont enregistrés. Un import déjà en attente est effacé.
- Succès, minuteur en lecture ou en pause : la séance et les quatre réglages attendent la remise à zéro, à la place d’un import en attente déjà présent. Le bandeau existant le dit. À la remise à zéro, la fusion, la sélection et les réglages s’appliquent ensemble. `PendingImport.settings` porte ces quatre réglages ; un import de fichier laisse ce champ vide et ne change pas les réglages. Ce lot est mémorisé, pour survivre à un rechargement.

Appliquer deux fois le même `href` laisse la même séance affichée et les mêmes réglages. `updatedAt` peut être réécrit. La lecture ne démarre pas toute seule.

## Retrait de Notion

Disparaissent le jeton, l’adresse de page, l’import automatique, l’appel à `api.notion.com`, le fichier `src/lib/notion.ts`, et les champs associés du dialogue de réglages.

Le dialogue garde le seuil, le son, la notification et l’enchaînement. Une ligne indique qu’un lien peut remplacer ces réglages à l’ouverture.

`loadSettings` ignore `notionToken`, `notionPageUrl` et `autoImport` s’ils sont encore dans le stockage. `saveSettings` ne les réécrit pas.

`sanitizeProgrammation` continue d’accepter `source: "notion"` et un `notionPageId` éventuel, pour les séances déjà enregistrées. La source d’une nouvelle séance lien est `"link"`. Une source inconnue reste lue comme `"local"`.

Le texte d’état vide ne propose plus de récupérer une page Notion. Il propose de découper la séance en étapes ou d’importer un fichier JSON.

Le README remplace la section Notion par ce contrat et l’exemple d’URL. La détection d’iframe (`useEmbed`) reste : elle ne fait que resserrer les marges.

L’import et l’export JSON, les formats de durée, et le comportement du minuteur hors lien restent inchangés.

## Tests

Tests unitaires de `parseSessionLink` :

- séance complète, réglages inclus, source `link` ;
- vingt étapes acceptées, vingt-et-une refusées ;
- adresse de 6 001 caractères refusée ; adresse de 6 000 caractères acceptée quand le reste est valide ;
- chaîne qui n’est pas une URL absolue : « Adresse illisible. » ;
- segment illisible cité dans le message, séance entière refusée ;
- `etapes` vide ou fait seulement de séparateurs : erreur ;
- `etapes` absent : `null`, même si d’autres paramètres sont présents ;
- caractères encodés (`%20`, `+`, `%26`) ;
- `alerte` absente, illisible, et hors intervalle ;
- `son`, `notif`, `suite` absents ou différents de `0` et `1` ;
- même contenu sans `id` : même identifiant ; contenu différent : identifiant différent ;
- `id` fourni, conservé ; `id` de plus de 200 caractères, remplacé par l’empreinte.

Test de fusion : deux lectures du même `id` ne laissent qu’une séance, avec le contenu le plus récent.

Vérification dans le navigateur : ouvrir une URL d’exemple, constater la séance et les réglages, recharger, puis ouvrir une URL invalide et constater le message sans remplacement de la séance.
