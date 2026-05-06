# PAP — Projeto Aliança Panorama

Gamified educational platform for FUVEST (Brazilian university entrance exam) preparation, featuring a hierarchical knowledge tree, spaceship cockpit dashboard, achievement system, notes, heatmap calendar, and Isa the AI owl mascot.

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
- API: Express 5 with pino logging
- DB: PostgreSQL + Drizzle ORM (57 nodes seeded from FUVEST 2026 PDF)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle for server)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-spec/orval.config.ts` — Orval codegen config
- `lib/api-client-react/` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (do not edit manually)
- `lib/db/src/schema/index.ts` — Drizzle schema (nodes, notes, node_progress, achievements)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/pap/src/components/MainApp.tsx` — main frontend (all UI components including IsaOwl)

## Architecture decisions

- Contract-first API: OpenAPI spec → codegen → React Query hooks and Zod schemas. Never write API types by hand.
- Square viewport (≈900×900px) enforced in `App.tsx` with black bars on desktop.
- Knowledge tree is hierarchical: root "0" → (E, R, 1/Ciências, F) → level-2 (11 CH, 12 CE, 13 CB, 14 Lin) → level-3 (disciplines) → level-4 (subtopics). Tree renders lazily.
- Achievement system: two achievements per node (explored + read). Read triggered after 30s of modal open.
- No `console.log` in server code — use `req.log` in handlers, `logger` singleton elsewhere.
- Isa owl: purely CSS/Framer Motion, no backend — preset keyword-matched responses for FUVEST topics.

## Product

- Space/universe themed UI in Portuguese
- Hierarchical knowledge tree (57 nodes from FUVEST 2026): Ciências Humanas (Port, Ing, Hist, Geo, Fil, Soc), Exatas (Mat, Fís, Quím), Biológicas (Bio), Linguagens (Arte, EF)
- Spaceship cockpit dashboard with notes, map, and social panels
- Achievement/badge system with toast notifications
- Activity heatmap calendar (last 90 days) in menu panel
- Ad totem column (collapsible) on the right
- Menu panel: Status, Calendário, Insígnias tabs
- Isa owl mascot: CSS-drawn, flies in on load, perches above map button, speech bubble greeting, chatbox with FUVEST study tips

## User preferences

- UI language: Portuguese (Brazil)
- No emojis in code or UI (Lucide icons only)
- Square viewport centered with black bars

## Gotchas

- `useListNodes()` with no args returns only nodes where `parentCode IS NULL` (i.e., just node "0"). Always pass `{ parentCode: "X" }` to fetch children.
- Orval zod output uses `mode: "single"` and `target: "generated/api.ts"` — no `schemas` property.
- `lib/api-zod/src/index.ts` must only export `./generated/api` (not a schemas folder).
- Always run codegen after editing openapi.yaml.
- IsaOwl phase state: "flying" → "perched" → "bubble" → "chat". useEffect must guard with early return to avoid TS7030.

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup
- `lib/api-spec/openapi.yaml` — full API contract with all routes and schemas
