# Cadence

Minuteur de séance pour un accompagnement en face à face. Une programmation est une suite d’étapes nommées. Cadence prévient discrètement à l’approche de la fin d’une étape, puis à la fin. La page est une application statique, prévue pour GitHub Pages, sur ordinateur comme sur mobile.

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

Le bandeau dans la page reste le signal quand la notification du navigateur n’est pas disponible.

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

## Lien de séance

Une adresse GET ouvre la séance et remplace les réglages de cette visite. Sans paramètre `etapes`, la page s’ouvre sur les séances déjà enregistrées.

```text
https://vous.github.io/cadence/?titre=Séance&alerte=80&son=1&notif=0&suite=1&id=page&etapes=5%20min%20—%20Rappel|40%20min%20—%20Travail
```

| Paramètre | Rôle |
|---|---|
| `etapes` | Jusqu’à 20 étapes séparées par `\|`. Chaque segment suit `5 min — Nom`, `1 h 30 — Bilan`, `00:45 — Souffle` ou `10 — Nom`. |
| `titre` | Nom de la séance. Absent : « Séance ». |
| `alerte` | Seuil de 50 à 95. Absent : 80. |
| `son`, `suite` | `1` ou `0`. Absent : `1`. |
| `notif` | `1` ou `0`. Absent : `0`. |
| `id` | Identifiant stable, 200 caractères au plus. Réouvrir le même lien remplace cette séance. |

Encoder `&`, `=`, `%`, `#` et `+` dans un nom. Après décodage, `|` sépare les étapes : un nom n’en contient pas. L’adresse complète tient sous 6 000 caractères.

La lecture ne démarre pas toute seule. Si un minuteur est déjà en cours, la séance du lien attend la remise à zéro.
