# PAP — Projeto Aliança Panorama

Gamified educational platform for FUVEST (Brazilian university entrance exam) preparation, featuring a hierarchical knowledge tree, spaceship cockpit dashboard, AI-generated exercises, achievement system, notes, heatmap calendar, and Isa the AI owl mascot.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/pap run dev` — run the React frontend (port 18434, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Framer Motion, Lucide icons, TanStack Query
- API: Express 5 with pino logging, express-session (memory store)
- DB: PostgreSQL + Drizzle ORM (57 nodes + users + exercises + social tables)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle for server)
- AI: `@workspace/integrations-openai-ai-server` via Replit AI Integrations proxy
- Payments: Stripe via Replit connector (`stripe-replit-sync` syncs to `stripe.*` schema in Postgres)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (do not edit manually)
- `lib/db/src/schema/` — Drizzle schema (nodes, notes, node_progress, achievements, users, exercises, social)
- `lib/db/src/schema/social.ts` — friendships, friend_messages, social_notes tables
- `artifacts/api-server/src/routes/` — Express route handlers (auth, nodes, notes, progress, exercises, social, stripe, admin)
- `artifacts/api-server/src/stripeClient.ts` — Stripe credential fetch + StripeSync factory
- `artifacts/api-server/src/routes/stripe.ts` — /stripe/plans, /stripe/checkout, /stripe/sync-tier, /stripe/portal (not in openapi.yaml)
- `artifacts/api-server/src/routes/admin.ts` — POST /admin/generate-content (tier-5 only, regenerates all node content)
- `artifacts/api-server/src/scripts/generate-content.ts` — standalone content generation runner (run via `pnpm --filter @workspace/api-server run generate-content`)
- `scripts/src/seed-products.ts` — creates Stripe products+prices (run via `pnpm --filter @workspace/scripts run seed-products`)
- `artifacts/pap/src/components/MainApp.tsx` — full frontend (auth, tree, exercises, nav guide, Isa, PlansModal)

## Architecture decisions

- Contract-first API: OpenAPI spec → codegen → React Query hooks and Zod schemas. Never write API types by hand.
- Square viewport (≈900×900px) enforced in `App.tsx` with black bars on desktop.
- Knowledge tree root is tier-aware: tier ≥ 4 → root "0" (all branches); tier < 4 → root "1" (Ciências only). Lock enforced server-side via `canAccess(tier, code)`.
- Auth: express-session with bcrypt-hashed passwords (cost 12). 6 users: guest/aluno1-4/root. Passwords are never stored or compared in plaintext. Login endpoint is rate-limited (10 attempts per 15 min per IP). Run `pnpm --filter @workspace/scripts run randomize-passwords` to assign unique strong passwords to all accounts.
- Exercises: AI-generated via OpenAI (3 MCQ per node), cached in DB, submitted attempts tracked.
- Achievement system: two per node (explored + read). Read triggered after 30s of modal open. Achievements are stored per-user and lazily created on first earn; the full catalog is generated on-the-fly from nodes in API responses.
- No `console.log` in server — use `req.log` in handlers, `logger` singleton elsewhere.
- Stripe: routes bypass OpenAPI/codegen. /stripe/plans queries stripe.products/prices (synced via stripe-replit-sync). /stripe/checkout creates a Stripe Checkout session. /stripe/sync-tier polls Stripe API for active subscription and updates users.tier. /stripe/portal opens the Stripe billing portal. Webhook at /api/stripe/webhook is registered BEFORE express.json() (needs raw Buffer). Stripe schemas in `stripe.*` Postgres schema created by `stripe-replit-sync`'s runMigrations (call before server start, or run manually: `node -e "import('stripe-replit-sync').then(m=>m.runMigrations({databaseUrl:process.env.DATABASE_URL}))"`).
- Node content: all 57 nodes have AI-generated 3-paragraph educational summaries (~1380 chars each). Regenerate with `pnpm --filter @workspace/api-server run generate-content` (skips nodes that already have content >150 chars).
- Isa owl: CSS/Framer Motion, personalized greeting by user name/tier, keyword-matched FUVEST responses.
- Social routes (/api/social/*) bypass OpenAPI/codegen — use direct fetch + useQuery in SocialModal components. Not in openapi.yaml.
- DB has both `password_plain` (legacy) and `password_hash` (bcrypt, active) columns. Auth uses `password_hash`. userCode is auto-generated on first /social/me call (lazy).

## Product

- Space/universe themed UI in Portuguese, no emojis (Lucide icons only)
- 6-tier user system: Visitante (0), Aluno I–IV (1–4), Dev (5).
- Hierarchical knowledge tree (57 nodes FUVEST 2026), tier-gated with lock icons
- AI-generated 3-question FUVEST-style MCQ exercises per node (Aluno I+ only)
- AI-generated rich node content: 3-paragraph educational summary per node (all 57 nodes populated)
- Stripe subscription plans: PAP Explorador (R$29,90/mês → tier 2) + PAP Completo (R$49,90/mês → tier 4)
- PlansModal: accessible via "Planos" button in Menu; fetches /api/stripe/plans, handles checkout redirect and tier sync after payment
- Spaceship cockpit dashboard: notes, map, social panels
- Social Area: profile (avatar/initials, score weighted by node depth × correct answers, user code), friends ring, chat com polling 5s, caderno compartilhado (shared notes between two users)
- Menu panel: Status, Calendário, Insígnias, Guia (navigation guide) tabs
- Activity heatmap calendar (last 90 days)
- Ad totem column (collapsible) on the right
- Isa owl mascot: flies in, perches, speech bubble, chat with FUVEST study tips, personalized by tier

## User preferences

- UI language: Portuguese (Brazil)
- No emojis in code or UI (Lucide icons only)
- Square viewport centered with black bars

## Gotchas

- `useListNodes()` with no args returns only nodes where `parentCode IS NULL` (i.e., just node "0"). Always pass `{ parentCode: "X" }` to fetch children.
- Social notes unique constraint: stored as (min(u1,u2), max(u1,u2)) so upsert works. Use onConflictDoUpdate with target [user1Id, user2Id].
- Score formula: for each correct exercise_attempt with userId → nodeCode.length × 10 pts. Only exercise_attempts has userId (notes/node_progress/achievements now also have user_id per-user).
- Notes, node_progress, and achievements all have `user_id NOT NULL`. Every route handler for these tables checks `req.session.userId` and returns 401 if not authenticated. All queries are scoped to the session user.
- The DB originally had `password_plain` column in `users` — it was renamed to `password_hash` and all passwords re-hashed with bcrypt (cost 12). Run `pnpm --filter @workspace/scripts run randomize-passwords` to assign unique strong passwords to all accounts and print them once.
- `drizzle-kit push` may prompt interactively for column renames — run migrations via executeSql or raw SQL if needed.
- Orval zod output uses `mode: "single"` — generated schema names are PascalCase (e.g. `LoginBody`, not `loginBodySchema`).
- `lib/api-zod/src/index.ts` must only export `./generated/api` (not a schemas folder).
- Always run codegen after editing openapi.yaml.
- `custom-fetch.ts` has `credentials: "include"` so session cookies are sent automatically.
- IsaOwl phase state: "flying" → "perched" → "bubble" → "chat". useEffect must guard with early return to avoid TS7030.

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup
- `lib/api-spec/openapi.yaml` — full API contract with all routes and schemas
