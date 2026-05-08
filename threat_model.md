# Threat Model

## Project Overview

PAP is a monorepo web application for FUVEST exam preparation. The production app consists of a React frontend in `artifacts/pap/`, an Express 5 API in `artifacts/api-server/`, PostgreSQL accessed through Drizzle in `lib/db/`, and an OpenAI-backed exercise generator through `lib/integrations-openai-ai-server/`.

Production assumptions for scanning:
- `artifacts/mockup-sandbox/` is dev-only and should be ignored unless production reachability is demonstrated.
- `NODE_ENV` is `production` in deployed environments.
- TLS is provided by the platform, so transport encryption is not analyzed as an application gap here.

## Assets

- **User accounts and sessions** — session cookies plus user identity and tier in the server-side session. Compromise enables impersonation and access to tier-gated content and personalized features.
- **Credentials** — user login names and passwords stored in the `users` table. Credential compromise affects every account and can lead to privilege escalation to the tier-5 dev account.
- **User-generated study data** — notes, progress state, achievements, daily activity, and exercise attempts. These are the primary user-specific records and must not be readable or writable across accounts.
- **Social data** — friend relationships, direct messages, shared notes, and user codes. These records are relationship-scoped and must not be readable or writable outside the intended friendship boundary.
- **Educational content and tier-gated node content** — the knowledge tree structure, node titles, node content, and AI-generated exercises. Lower-tier and unauthenticated users must not gain access to higher-tier material or metadata that reveals protected curriculum structure.
- **Application secrets** — `DATABASE_URL`, `SESSION_SECRET`, and OpenAI credentials used through the integration package. Exposure would permit database compromise, session forgery, or abuse of paid AI resources.

## Trust Boundaries

- **Browser to API** — all frontend input crosses into untrusted server routes under `/api`. The server must validate, authenticate, and authorize every state-changing or data-returning request.
- **Cross-origin website to API** — other web origins are untrusted even when requests come from a real browser. The application must not let third-party sites create authenticated sessions or trigger state changes through the victim's browser without an explicit anti-CSRF or origin-validation control.
- **API to PostgreSQL** — route handlers can read and write all application data. Broken access control or unsafe queries at the API layer expose the entire data store.
- **API to OpenAI integration** — the exercises route sends node-derived content to an external model and consumes model output. This boundary matters for cost control, abuse resistance, and robust parsing of model responses.
- **Unauthenticated to authenticated users** — login establishes a meaningful trust boundary because notes, progress, attempts, and higher-tier node content are user-specific.
- **Lower-tier to higher-tier users** — tier gating is a server-side authorization boundary for node access and feature access.
- **Production to dev-only artifacts** — `artifacts/mockup-sandbox/` is explicitly out of production scope unless routing or build configuration shows otherwise.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/pap/src/components/MainApp.tsx`.
- **Highest-risk areas:** `artifacts/api-server/src/routes/auth.ts`, `social.ts`, `nodes.ts`, `progress.ts`, `exercises.ts`, plus `artifacts/api-server/src/lib/canAccess.ts` and `lib/db/src/schema/{users,social,progress}.ts`.
- **Public vs authenticated vs admin surfaces:** `/api/healthz` is public; session-backed auth lives under `/api/auth/*`; notes, progress, achievements, daily activity, exercise attempt flows, and all `/api/social/*` routes are authenticated user data; tiered node access is an authorization boundary and the client root selector (`rootCodeForTier`) is not itself an authorization control.
- **Usually ignore unless proven reachable:** `artifacts/mockup-sandbox/`, generated `dist/` outputs, and codegen outputs except when confirming surface shape.

## Threat Categories

### Spoofing

Authentication is implemented with Express sessions and application-managed credentials. The system must ensure that every login is backed by strong credential handling, that session cookies cannot be reused to impersonate other users, and that protected routes do not treat the mere presence of a cookie as sufficient proof without checking the corresponding server-side user record.

Session-creating routes are part of this boundary as well. The login flow must not allow a third-party website to bind a victim browser to an attacker-controlled account through cross-site form submission, cross-origin XHR, or overly permissive CORS/origin handling.

### Tampering

The browser is untrusted. The server must prevent users from creating, modifying, or deleting notes, progress records, achievements, exercise attempts, messages, and shared social notes outside their own account or approved friendship relationships. Tier checks must be enforced server-side rather than relying on frontend lock icons, hidden controls, or the UI's tier-based root-node selection.

For the social system, a friendship is a meaningful authorization boundary rather than a cosmetic follow. Knowledge of a `userCode` alone must not grant unilateral write access into another user's friend list, direct-message surface, or shared-note workspace.

### Information Disclosure

User study data is sensitive within the context of the platform even if it is not financial data. API responses for notes, progress, achievements, daily activity, attempts, messages, and shared social notes must be scoped to the authenticated user and intended friend relationship, and higher-tier node content or metadata must not be exposed to lower-tier users through list, progress, or summary endpoints. Secrets and cookies must stay out of logs and client bundles.

### Denial of Service

The exercise generation route can trigger external AI usage and database writes. Public or weakly protected access to expensive generation paths, missing throttling on login and exercise endpoints, or unbounded request bodies can let an attacker consume resources or degrade service availability.

### Elevation of Privilege

The most important privilege boundaries are unauthenticated vs authenticated users and lower-tier vs higher-tier accounts. The application must enforce ownership, friendship, and tier checks in API handlers, must not rely on globally shared tables for user-specific state, and must protect the highest-tier dev/root account from compromise through weak or shared credentials.
