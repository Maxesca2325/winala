# Winala (dossier `winala/`)

Appli web (PWA) de pronostics foot statistiques pour Haïti. Dépôt dédié. Site : https://maxesca2325.github.io/winala/

- Lire d'abord : `docs/brief.md` (décisions fermes), `PRODUCT.md`, `DESIGN.md`, `README.md` (état d'avancement).
- Next.js 16 (Cache Components activé) : lire `node_modules/next/dist/docs/` avant d'utiliser une API, voir `AGENTS.md`.
- Interdits : un LLM qui produit une probabilité, un faux historique, une promesse de gain, un remboursement sur prono perdu, une clé API côté client.
- Toute donnée démo porte l'étiquette « Exemple ».
- Tests SQL : `supabase/tests/` (voir README). Toute modification des règles de crédits doit garder `ALL TESTS PASSED`.
- Skills du projet dans `.claude/skills` (impeccable, ui-ux-pro-max, taste-skill, supabase, vibesec-skill, web-quality…).
