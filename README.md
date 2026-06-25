# BCU UI Admin

Admin web para operaciones sobre la API del backend BCU:

- Clientes de integracion
- API keys y scopes
- Usuarios administradores

Stack:

- Next.js 16 (App Router)
- NextAuth (credentials provider)
- shadcn/ui
- TanStack Query
- TanStack Table

## Requisitos

- Node.js 20+
- Backend `bcu` ejecutando y accesible

## Desarrollo

Instalar dependencias:

```bash
pnpm install
```

Levantar en local:

```bash
pnpm dev
```

Abrir `http://localhost:3000`.

## Configuracion

Variables de entorno requeridas:

```env
AUTH_SECRET=<secreto para firmar la sesion NextAuth>
BCU_API_BASE_URL=http://localhost:8080
```

Variable opcional (usada como fallback de `BCU_API_BASE_URL`):

```env
NEXT_PUBLIC_DEFAULT_BCU_API_URL=http://localhost:8080
```

Definirlas en `.env.local` para desarrollo.

## Autenticacion

El login usa NextAuth con provider de credenciales. Al autenticarse, el backend emite un JWT que se almacena en la sesion NextAuth como `session.backendToken`. Ese token es el que se usa para todas las llamadas al backend.

El frontend nunca envia API keys. Todos los requests pasan por proxies server-side que inyectan `Authorization: Bearer {backendToken}`.

## Proxies BFF

| Ruta Next.js | Backend target |
|---|---|
| `/api/admin/[[...path]]` | `BCU_API_BASE_URL/api/v1/admin/integrations/**` |
| `/api/admin-users/[[...path]]` | `BCU_API_BASE_URL/api/v1/admin/users/**` |

Cada proxy verifica que haya sesion valida antes de reenviar el request.

## Scripts

- `pnpm dev`: modo desarrollo
- `pnpm build`: build de produccion
- `pnpm lint`: lint
