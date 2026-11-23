# WINALA — Brief de développement (handoff Claude Code)

> À coller en entrée de session Claude Code. Ce document cadre tout le build.
> Il est issu d'une session de conception : les décisions ci-dessous sont **fermes**.

---

## 0. Rôle & mission

Tu construis **Winala**, une application web (PWA) de pronostics de **football** pour le **marché haïtien**.

**Positionnement :** assistant d'**analyse statistique** et de probabilités. **Jamais** de promesse de « score garanti » ni de « gains assurés ».

**Contrainte UX critique :** mobile-first, ultra-léger, optimisé pour connexions 3G/4G instables et smartphones d'entrée de gamme.

---

## 1. Décisions figées (non négociables)

**Marché**
- Haïti uniquement au lancement. Devise : **HTG**. (Afrique francophone = plus tard, même moteur.)

**Produit**
- Pronostics football, grands championnats (Premier League, La Liga, Serie A, Ligue 1), + Ligue des Champions / coupes traitées à part (données plus pauvres).

**Intelligence = hybride, mais v1 SANS LLM**
- Un **modèle statistique** (Dixon-Coles / Poisson sur données + xG) calcule **TOUS** les nombres : probabilités 1X2, BTTS, Over/Under 2.5, value bet.
- Les **3 arguments** sont générés par **templates** remplis avec les nombres du modèle (pas de LLM en v1).
- **RÈGLE D'OR :** le LLM ne produit **jamais** la probabilité finale. En phase 2, le LLM servira uniquement à la prose et au contexte qualitatif (blessés, enjeu, compo), avec un ajustement **borné (±5 % max) et tracé** — jamais une invention libre.

**Monétisation**
- **Crédits uniquement** (pas d'abonnement en v1).
- **3 crédits gratuits** à l'inscription (protection anti-multicompte).
- Grille (HTG) : Découverte 5 cr / 100 · Week-end 15 cr / 250 · Pro 40 cr / 500.
- Coût des actions : 1 crédit = analyse standard · 2 crédits = rapport Value Bet approfondi.

**Gratuit / acquisition**
- **1 match par jour entièrement offert** (« prono du jour »), destiné à être relayé sur la page AyitiSport.
- Matchs verrouillés : seul l'**indice de confiance** est visible, les chiffres sont cachés.

**Tracker public (pilier de confiance)**
- Pronostics **horodatés AVANT le match**, taux de réussite **cumulé public**, visible **même sans compte**, **avant** le paywall.
- **Aucun faux chiffre.** Le tracker est vide tant qu'il n'y a pas de vrais résultats réglés.

**Remboursement**
- **OUI** (auto) si le match n'est pas joué (reporté / annulé).
- **NON** sur pronostics perdants. À la place : fidélité basée sur l'**usage**.

**Paiement**
- **MonCash + NatCash**, en HTG. Point dur connu : pas de passerelle/webhook propre en Haïti → prévoir un mécanisme robuste (agrégateur ou confirmation manuelle) avec **webhooks idempotents**.

---

## 2. Ordre de construction (IMPORTANT)

Le modèle n'est **pas encore validé** (backtest à faire, hors Claude Code). Construis dans cet ordre :

1. **Landing page + liste d'attente** — réel, livrable immédiatement.
2. **Shell de l'app** (dashboard, carte match, écran analyse, flux de déblocage) avec **données démo clairement étiquetées « exemple »**.
3. **Backend Supabase** (auth, crédits, transactions, RPC atomiques).
4. **Branchement du modèle validé** + données réelles (après backtest).
5. **Paiement** MonCash / NatCash.

> Ne jamais mettre en ligne des écrans de pronostics avec de fausses données présentées comme réelles.

---

## 3. Stack technique

- **Front :** Next.js (App Router) + TypeScript + Tailwind. PWA (manifest + service worker). Mobile-first, léger.
- **Back :** Supabase (Postgres, Auth par téléphone +509 / email, Edge Functions, RPC/stored procedures).
- **Sécurité :** aucune clé API (data, paiement) côté client — tout passe par le backend / Edge Functions.

---

## 4. Schéma de base de données

- **users** : `id`, `phone_or_email`, `country_code` (default `HT`), `credits_balance` (int, default 3), `referral_code`, `created_at`.
- **matches** : `id` (API id), `league_name`, `home_team`, `away_team`, `kickoff_time`, `status` (SCHEDULED, LIVE, FINISHED, POSTPONED, CANCELLED).
- **model_predictions** : `match_id` (FK), `analysis_type` (STANDARD, DEEP), `content_json` (JSONB), `is_lineup_updated` (bool), `generated_at`. *(cache de la sortie du modèle — stocké, débité à la lecture, jamais recalculé par match déjà analysé.)*
- **user_unlocks** : `id`, `user_id` (FK), `match_id` (FK), `credits_spent`, `unlocked_at`. **UNIQUE(`user_id`, `match_id`)**.
- **transactions** : `id`, `user_id` (FK), `provider` (MONCASH, NATCASH), `amount`, `currency` (HTG), `credits_added`, `status` (PENDING, COMPLETED, FAILED), `external_ref`, `created_at`.
- **predictions_results** *(tracker public)* : `id`, `match_id` (FK), `market`, `predicted_pick`, `probability`, `result` (WIN, LOSS, VOID), `published_at` (avant le match), `settled_at`.

---

## 5. Règles techniques critiques (edge cases)

- **Débit atomique :** débit du crédit + insertion dans `user_unlocks` = **une seule transaction SQL** (RPC/stored procedure) pour empêcher le double débit sur double-clic en connexion lente.
- **Déjà débloqué :** si l'utilisateur possède déjà le match → afficher immédiatement, **0 crédit** débité.
- **Match reporté/annulé** avant le coup d'envoi → fonction de **remboursement automatique** des crédits aux utilisateurs ayant débloqué.
- **Webhooks idempotents :** vérifier `external_ref` dans `transactions` avant de créditer (éviter le double-crédit).
- **Mise à jour H-1 :** dès que les compositions officielles sont dispo, régénérer **une fois** la prédiction, flag `is_lineup_updated = true`, visible **gratuitement** pour les débloqueurs.

---

## 6. Le modèle (fait SÉPARÉMENT, en Python — pas dans Claude Code)

- Dixon-Coles / Poisson, **calibré automatiquement par ligue**. Entrée : résultats historiques + xG.
- **Validation obligatoire par backtest AVANT branchement** : juger sur la **calibration** (Brier / log-loss) et le **ROI face aux cotes**, pas sur le simple % de réussite.
- Claude Code **consomme la sortie** du modèle (JSON ci-dessous) et la stocke dans `model_predictions`. **Ne réimplémente pas** le modèle dans le front.

**Format JSON de sortie du modèle :**
```json
{
  "match_id": "string",
  "probabilities": { "home": 0, "draw": 0, "away": 0 },
  "top_pick": "string",
  "markets": {
    "btts": { "prediction": "Oui/Non", "confidence": 0 },
    "over_under_2_5": { "prediction": "Over/Under", "confidence": 0 }
  },
  "value_bet": { "market": "string", "bookmaker_odds": 0.0, "model_fair_odds": 0.0, "edge_percent": 0 },
  "key_arguments": ["point 1", "point 2", "point 3"],
  "risk_level": "Faible | Moyen | Élevé"
}
```

---

## 7. Écrans (UX)

1. **Inscription** : téléphone +509 / email → 3 crédits gratuits.
2. **Dashboard** : header fixe (solde + bouton **Recharger**), filtres (Aujourd'hui / Demain / Par ligue), liste des matchs (logos, heure locale, statut 🔒/🔓).
3. **Match verrouillé** : match + indice de confiance flou (ex. « confiance élevée »), chiffres cachés.
4. **Match débloqué** : 3 barres de probabilité (Domicile/Nul/Extérieur), BTTS, Over/Under 2.5, indice de confiance, **encart Value Bet** (seulement si réel et ligue calibrée), 3 arguments templatés, mention « analyse statistique, pas un score garanti ».
5. **Tracker public** : accessible sans compte, courbe de réussite + liste des pronos passés avec résultat. **Vide au départ** (pas de faux chiffres).
6. **Recharge** : pays (HT) → pack → MonCash/NatCash → transaction PENDING → confirmation.

---

## 8. Design

- Mobile-first, léger, rapide. Laisser la direction esthétique aux skills de design installés (ui-ux-pro-max, taste-skill, designer-skills). **Pas de template générique.**
- **Honnêteté visuelle** : jamais de faux chiffres de performance, jamais de promesse de gains.

---

## 9. Interdits (à ne JAMAIS faire)

- Un LLM qui invente ou produit les probabilités.
- Un faux historique / faux taux de réussite.
- Toute promesse de gains ou de « scores garantis ».
- Un remboursement sur pronostic perdant.
- Des clés API côté client.
