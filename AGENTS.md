<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Auth Architecture

Authentication uses NextAuth (credentials provider). On login the backend issues a JWT that is stored in the NextAuth session as `session.backendToken`. This token is a **backend JWT**, distinct from the NextAuth session token.

The frontend never uses API keys. All backend calls go through server-side proxy routes that inject `Authorization: Bearer {session.backendToken}`.

## BFF Proxy Pattern

Every proxy route in `src/app/api/` follows this pattern:

1. Call `auth()` from `@/auth` — return 401 if no session.
2. Extract `session.backendToken` — return 401 if absent.
3. Resolve `BCU_API_BASE_URL` from env.
4. Forward the request with `Authorization: Bearer {backendToken}`.
5. If the backend returns 401, surface it as 401 to the client.
6. Otherwise pass the status and body through unchanged.

**Do not use `BCU_ADMIN_API_KEY` or any API key in the frontend.** The backend no longer accepts API keys for admin panel endpoints.

## Existing Proxies

| Route | Backend target |
|---|---|
| `src/app/api/admin/[[...path]]` | `/api/v1/admin/integrations/**` |
| `src/app/api/admin-users/[[...path]]` | `/api/v1/admin/users/**` |

## Client-Side API Libs

| File | Calls |
|---|---|
| `src/lib/admin-api.ts` | `/api/admin/*` (integrations, API keys, scopes, audit) |
| `src/lib/admin-users-api.ts` | `/api/admin-users/*` (user CRUD) |

## Domain Types (`src/types/admin.ts`)

Panel users are `UserResponse`, `UserRole`, `CreateUserRequest`, `UpdateUserRequest` — no `Admin` prefix.
