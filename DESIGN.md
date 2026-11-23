# Design

Direction choisie par l'utilisateur (2026-11-22) : **appli sport standard, jouée proprement**, niveau de finition de **FotMob**. Pas de décor « pari », pas de néon, pas de promesse.

## Scène

Un fan en Haïti, téléphone Android d'entrée de gamme, le soir avant ou pendant les matchs, souvent en 3G. Thème **sombre par défaut** ; le thème clair suit le réglage du téléphone (lecture en plein soleil).

## Couleurs (`src/app/globals.css`)

| Rôle | Sombre | Clair | Usage |
|---|---|---|---|
| `bg` | `#0c0e12` | `#f2f3f5` | fond |
| `surface` / `-2` / `-3` | `#15181e` / `#1c2027` / `#262b34` | `#fff` / `#f1f3f6` / `#e5e8ed` | cartes, champs, pistes de barres |
| `line` | `#2a2f38` | `#dfe3e9` | séparateurs, bordures |
| `text` / `-2` / `-3` | `#edf0f3` / `#a3acb8` / `#808996` | `#0e1116` / `#4b5563` / `#626b78` | texte, secondaire, tertiaire (AA) |
| `accent` | `#ffb224` | `#ffb224` | actions, crédits, marque. Texte dessus : `#1a1200` |
| `accent-ink` | `#ffb224` | `#8f5200` | texte ambre (lisible sur fond clair) |
| `home` / `draw` / `away` | `#4b9bff` / `#9aa4b2` / `#ff6e5a` | `#1f6fe0` / `#6f7a8a` / `#dc4128` | barres 1X2 |
| `good` / `warn` / `bad` | `#34c77b` / `#ffb224` / `#ff6e5a` | `#12824a` / `#a86400` / `#c9361f` | confiance, risque, statut |

Stratégie : neutres + un accent ambre. La couleur sert les données (1X2, risque), pas la décoration.

## Typo

Une seule police, **Archivo** variable (poids + largeur), auto-hébergée par `next/font`.
- Corps : largeur 100 %, chiffres tabulaires partout.
- `.font-display` : largeur 78 %, graisse 800 — titres, pourcentages, scores, prix.
- `.font-wide` : largeur 118 % — logotype « winala ».

## Logo

Carré ambre arrondi, un **W** dont le dernier trait monte comme une courbe de probabilité (`src/components/logo.tsx`, `src/app/icon.svg`, icônes PWA dans `public/`).

## Composants clés

- Carte d'analyse (`components/analysis.tsx`) : barre 1X2 segmentée, marchés BTTS / ±2,5 avec mini-barres, risque, encart Value Bet (ambre, seulement DEEP + ligue calibrée), 3 arguments numérotés, mention « analyse statistique ».
- Indice de confiance : 3 points + mot (faible / moyenne / élevée), seul signal visible sur un match verrouillé.
- Étiquette **EXEMPLE** (bordure pointillée) sur toute donnée démo.
- Déblocage en deux temps (« Débloquer » → « Confirmer ») et bouton bloqué pendant l'envoi.
- Rayons : 14 px cartes, 12 px boutons/champs, pilules pour chips. Icônes : lucide.

## Mouvement

Une seule animation signature : les barres de probabilité se remplissent (700 ms, ease-out expo) et l'analyse apparaît en fondu net à la sortie du flou. Désactivé si `prefers-reduced-motion`.
