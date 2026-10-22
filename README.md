# Cadence

Minuteur de séance pour un accompagnement en face à face. Une programmation est une suite d’étapes nommées. Cadence prévient discrètement à l’approche de la fin d’une étape, puis à la fin. La page est une application statique, prévue pour GitHub Pages et pour un bloc `/embed` dans Notion, sur ordinateur comme sur mobile.

## Lancer en local

```bash
npm install
npm run dev
```

Le serveur de développement écoute sur le port **4317**.

```bash
npm test
npm run build
npm run preview
```

## Déployer sur GitHub Pages

Le dépôt contient `.github/workflows/deploy.yml`. Dans les réglages du dépôt, ouvrez **Pages** et choisissez **GitHub Actions** comme source. Chaque poussée sur `main` publie le dossier `dist`.

Le site est construit avec une base relative (`./`), ce qui fonctionne pour un site utilisateur (`https://vous.github.io/`) comme pour un site de projet (`https://vous.github.io/cadence/`).

## Programmer une séance

Ajoutez des étapes (nom, minutes, secondes, note). Plusieurs programmations peuvent coexister. La séance en cours reprend après un rechargement : le temps s’appuie sur l’horloge, pas sur un compteur qui dérive dans un onglet en veille.

Réglages :

- alerte quand un pourcentage du temps de l’étape est écoulé (50 à 95, défaut 80) ;
- son discret, débloqué par le bouton Lecture ;
- enchaînement automatique ;
- notification du navigateur seulement si l’onglet est en arrière-plan et que l’autorisation a été donnée.

Dans un embed Notion, la notification système est souvent bloquée. Le bandeau dans la page reste le signal.

La barre d’espace lance ou met en pause, sauf quand le curseur est dans un champ.

## Export et import

**Exporter** télécharge `cadence-programmations.json` :

```json
{
  "version": 1,
  "programmations": []
}
```

**Importer** fusionne par identifiant. Si une séance est en lecture ou en pause, le fichier n’interrompt pas le minuteur : il s’applique à la prochaine remise à zéro.

## Notion

1. Sur [Notion integrations](https://www.notion.so/my-integrations), créez une intégration interne et copiez le jeton.
2. Ouvrez la page (ou la base) et partagez-la avec cette intégration.
3. Dans Cadence, collez le jeton et l’URL, puis **Importer maintenant**. Cochez **Importer à l’ouverture** pour le refaire tout seul.
4. Dans Notion, tapez `/embed` et collez l’URL de la page GitHub Pages.

Pour qu’un embed pointe vers une page précise :

```text
https://vous.github.io/cadence/?page=https://www.notion.so/…
```

`?page=` est utilisé à l’ouverture quand l’import automatique est activé. Le jeton n’est jamais mis dans l’URL. Il reste dans le `localStorage` de ce navigateur. Sur Safari, le stockage d’une iframe tierce peut être distinct de l’onglet normal : dans ce cas, collez le jeton une fois dans l’embed lui-même.

Formats reconnus, y compris ensemble sur la même page :

- liste à puces, numérotée ou de tâches, durée en tête : `25 min — Travail profond`, `5 min — Pause`, `1 h 30 — Bilan`, `00:45 — Souffle`, `10 — Nom` ;
- base (inline ou page entière) : le titre de la ligne est le nom, une colonne nombre `Durée`, `Minutes` ou `Duration` donne les minutes, `Ordre` est facultatif, `Note` aussi.

Le titre de la page Notion devient le nom de la programmation. Si la séance locale est déjà lancée, l’import attend la remise à zéro.
