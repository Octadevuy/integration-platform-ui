# BCU UI Admin

Admin web para operaciones sobre la API de autenticacion del backend BCU:

- Clientes de integracion
- API keys
- Asignacion y remocion de scopes

Stack:

- Next.js 16 (App Router)
- shadcn/ui
- TanStack Query
- TanStack Table

## Requisitos

- Node.js 20+
- Backend `bcu` ejecutando y accesible (por defecto `http://localhost:8080`)

## Desarrollo

Instalar dependencias:

```bash
npm install
```

Levantar en local:

```bash
npm run dev
```

Abrir:

- `http://localhost:3000`

## Configuracion

Variable opcional:

- `NEXT_PUBLIC_DEFAULT_BCU_API_URL`

Ejemplo:

```bash
NEXT_PUBLIC_DEFAULT_BCU_API_URL=http://localhost:8080 npm run dev
```

Tambien podes definir en runtime:

- URL base del backend
- API key con scope `admin.manage`

Desde la pantalla de conexion del admin.

## Como funciona la integracion

El frontend no llama al backend directamente. Usa un proxy interno de Next:

- `src/app/api/admin/[...path]/route.ts`

Ese proxy reenvia requests a:

- `/api/v1/admin/integrations/**`

e inyecta el header:

- `X-API-Key`

## Scripts

- `npm run dev`: modo desarrollo
- `npm run lint`: lint
- `npm run build`: build de produccion
