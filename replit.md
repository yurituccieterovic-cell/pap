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

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (do not edit manually)
- `lib/db/src/schema/` — Drizzle schema (nodes, notes, node_progress, achievements, users, exercises, social)
- `lib/db/src/schema/social.ts` — friendships, friend_messages, social_notes tables
- `artifacts/api-server/src/routes/` — Express route handlers (auth, nodes, notes, progress, exercises, social)
- `artifacts/pap/src/components/MainApp.tsx` — full frontend (auth, tree, exercises, nav guide, Isa)

## Architecture decisions

- Contract-first API: OpenAPI spec → codegen → React Query hooks and Zod schemas. Never write API types by hand.
- Square viewport (≈900×900px) enforced in `App.tsx` with black bars on desktop.
- Knowledge tree root is tier-aware: tier ≥ 4 → root "0" (all branches); tier < 4 → root "1" (Ciências only). Lock enforced server-side via `canAccess(tier, code)`.
- Auth: express-session with bcrypt-hashed passwords (cost 12). 6 users: guest/aluno1-4/root, all password "pap". Passwords are never stored or compared in plaintext.
- Exercises: AI-generated via OpenAI (3 MCQ per node), cached in DB, submitted attempts tracked.
- Achievement system: two per node (explored + read). Read triggered after 30s of modal open.
- No `console.log` in server — use `req.log` in handlers, `logger` singleton elsewhere.
- Isa owl: CSS/Framer Motion, personalized greeting by user name/tier, keyword-matched FUVEST responses.
- Social routes (/api/social/*) bypass OpenAPI/codegen — use direct fetch + useQuery in SocialModal components. Not in openapi.yaml.
- DB has both `password_plain` (legacy) and `password_hash` (bcrypt, active) columns. Auth uses `password_hash`. userCode is auto-generated on first /social/me call (lazy).

## Product

- Space/universe themed UI in Portuguese, no emojis (Lucide icons only)
- 6-tier user system: Visitante (0), Aluno I–IV (1–4), Dev (5). All password "pap".
- Hierarchical knowledge tree (57 nodes FUVEST 2026), tier-gated with lock icons
- AI-generated 3-question FUVEST-style MCQ exercises per node (Aluno I+ only)
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
- Score formula: for each correct exercise_attempt with userId → nodeCode.length × 10 pts. Only exercise_attempts has userId (node_progress/achievements are global/shared tables).
- Orval zod output uses `mode: "single"` — generated schema names are PascalCase (e.g. `LoginBody`, not `loginBodySchema`).
- `lib/api-zod/src/index.ts` must only export `./generated/api` (not a schemas folder).
- Always run codegen after editing openapi.yaml.
- `custom-fetch.ts` has `credentials: "include"` so session cookies are sent automatically.
- IsaOwl phase state: "flying" → "perched" → "bubble" → "chat". useEffect must guard with early return to avoid TS7030.

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup
- `lib/api-spec/openapi.yaml` — full API contract with all routes and schemas
