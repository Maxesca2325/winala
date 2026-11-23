# Winala

Pronostics foot **statistiques** pour Haïti. PWA mobile-first, prix en HTG. Brief complet : [`docs/brief.md`](docs/brief.md). Contexte produit : [`PRODUCT.md`](PRODUCT.md). Système visuel : [`DESIGN.md`](DESIGN.md).

## Où on en est (ordre du brief §2)

| Étape | État |
|---|---|
| 1. Landing + liste d'attente | **Fait.** `/`, `/tracker`, `/jeu-responsable`. La liste d'attente écrit dans Supabase (`waitlist`) dès que les clés sont configurées. |
| 2. Shell de l'app, données démo « exemple » | **Fait.** `/app`, `/app/match/[id]`, `/app/credits`, `/connexion`. Tout est en mode démo (crédits dans le navigateur, aucun paiement), bannière + étiquettes « Exemple », pages `noindex`. |
| 3. Backend Supabase | **Écrit et testé en local** (Postgres 16) : `supabase/migrations`, `supabase/functions`. Pas encore appliqué à un projet. L'app n'est pas encore branchée sur l'auth/les RPC (elle reste en démo). |
| 4. Modèle validé + vraies données | À faire après le backtest (hors de ce dépôt). Le front lit seulement le JSON du modèle. |
| 5. Paiement MonCash / NatCash | Le circuit idempotent est prêt côté base (`create_payment`, `confirm_payment`, `payment-webhook`). Reste à choisir l'agrégateur ou le back-office manuel. |

## Lancer en local

```bash

npm install
cp .env.example .env.local   # facultatif : sans clés, la liste d'attente affiche « pas encore connectée »
npm run dev                  # http://localhost:3000
```

`npm run build && npm start` pour tester le service worker (il ne s'active qu'en production).

## Backend Supabase

```bash
npx supabase link --project-ref <ref>
npx supabase db push                                  # applique supabase/migrations
npx supabase secrets set INGEST_SECRET=... PAYMENT_WEBHOOK_SECRET=...
npx supabase functions deploy ingest-predictions payment-webhook
```

Puis dans le dashboard : activer l'auth téléphone (fournisseur SMS) et email.

### Ce que fait la base

- **Débit atomique** — `unlock_match(match_id, type)` verrouille la ligne du profil, vérifie, débite et enregistre le déblocage dans une seule transaction. Testé avec deux sessions simultanées : un seul débit.
- **Déjà débloqué** → 0 crédit. **STANDARD → DEEP** → on paie seulement la différence (1 crédit).
- **Match du jour** (`daily_free_match`) → analyse complète, 0 crédit.
- **Match reporté / annulé** → un trigger rembourse automatiquement, une seule fois (`refunded_at`), et passe les lignes du tracker en `VOID`.
- **Paiement idempotent** — `confirm_payment` refuse de créditer deux fois la même référence `WN-…` ou le même identifiant de transaction MonCash/NatCash (`UNIQUE(provider, external_ref)`). Le prix vient toujours du pack, jamais du client.
- **3 crédits offerts une seule fois par numéro/email**, même si le compte est supprimé puis recréé (empreinte dans `signup_grants`).
- **Tracker honnête** — lignes écrites avant le coup d'envoi (sinon refusées), jamais modifiables ni supprimables, réglées une seule fois. Avant le match, la vue publique montre seulement une empreinte SHA-256 : le tracker gratuit ne divulgue pas un prono payant, et chacun peut vérifier après coup que rien n'a changé.
- **Value bet** visible seulement en analyse DEEP et sur une ligue `calibrated = true`. Toutes les ligues démarrent à `false` : les passer à `true` seulement après le backtest.
- **RLS partout.** Les clients lisent leurs propres lignes. Personne ne lit `model_predictions` directement ni n'écrit son solde. Les fonctions sensibles sont réservées au `service_role`.

### Tests SQL

```bash
# Postgres 15+ local, base vide
psql -d test -f supabase/tests/local_stubs.sql -f supabase/migrations/20261122000000_winala_core.sql
psql -d test -f supabase/tests/winala_test.sql      # → ALL TESTS PASSED (34 vérifications)
```

### Brancher le modèle (étape 4)

Le pipeline Python appelle `POST /functions/v1/ingest-predictions` avec l'en-tête `x-ingest-secret`. Corps : `{ "kind": "prediction", "match": {...}, "analysis_type": "STANDARD", "calibrated": true, "output": <JSON du modèle> }`. Autres `kind` : `lineup_update` (H-1, une seule fois), `status` (reporté/annulé → remboursement), `settle` (WIN/LOSS/VOID), `free_match`. Les 3 arguments sont réécrits par templates (`_shared/arguments.ts`) ; aucun LLM en v1.

### Paiement (étape 5)

1. L'appli appelle `create_payment(pack, provider)` → transaction `PENDING` avec une référence `WN-XXXXXX`.
2. L'utilisateur paie sur MonCash/NatCash en citant la référence.
3. L'agrégateur, ou le back-office après vérification manuelle du relevé, appelle `payment-webhook` avec la signature HMAC `x-winala-signature`. Les rejeux sont sans danger.

## Skills installés (`.claude/skills`)

Demandés : impeccable, ui-ux-pro-max, taste-skill (`design-taste-frontend`), vercel-labs/agent-skills, julianoczkowski/designer-skills, playwright-cli.
Ajoutés pour ce projet : `supabase` + `supabase-postgres-best-practices` (officiels Supabase), `vibesec-skill` (sécurité web), `web-quality-audit`, `performance`, `core-web-vitals`, `accessibility`, `seo`, `best-practices` (Addy Osmani).

Les images de référence de taste-skill (38 Mo) ne sont pas versionnées : `npx skills add Leonxlnx/taste-skill -a claude-code -y --copy` pour les récupérer. `skills-lock.json` liste les versions.
