# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── obj-blueprint/      # OBJ Blueprint Maker (React + Vite)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Applications

### OBJ Blueprint Maker (`artifacts/obj-blueprint`)

A 3D OBJ file measurement and blueprint tool for architects and engineers.

**Features:**
- Import `.obj` files and view them in 3D using Three.js
- Switch between 3D and 2D orthographic views (Front, Back, Left, Right)
- Draw architectural dimension chains with tick marks and measurement labels
- Manually edit dimension values
- Set unit (mm, cm, m, in, ft) and scale factor
- Save/load projects from the backend
- Export blueprints as PDF (architectural style with title block)

**Key packages**: `three`, `@react-three/fiber`, `@react-three/drei`, `jspdf`, `zustand`, `uuid`

**Frontend structure:**
- `src/store/use-blueprint-store.ts` — Zustand store for all state
- `src/components/blueprint/BlueprintCanvas.tsx` — Main canvas with WebGL detection
- `src/components/blueprint/ThreeCanvas.tsx` — Three.js 3D/2D viewport
- `src/components/blueprint/ModelViewer.tsx` — OBJ file renderer
- `src/components/blueprint/DimensionLine.tsx` — Architectural dimension annotations
- `src/components/blueprint/PdfExport.ts` — jsPDF blueprint export
- `src/components/layout/Sidebar.tsx` — Left sidebar (projects, import, settings)
- `src/components/layout/Topbar.tsx` — Top toolbar (views, draw, export)
- `src/components/layout/RightPanel.tsx` — Dimension list and editor

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## API

### Endpoints

- `GET /api/healthz` — health check
- `GET /api/projects` — list all projects
- `POST /api/projects` — create a project
- `GET /api/projects/:id` — get project by ID
- `PUT /api/projects/:id` — update project
- `DELETE /api/projects/:id` — delete project

### Project Schema

```sql
projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  obj_data TEXT,           -- raw .obj file content
  dimensions TEXT,         -- JSON string of dimension chain data
  unit TEXT DEFAULT 'mm',  -- mm, cm, m, in, ft
  scale DOUBLE PRECISION DEFAULT 1,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/` use `@workspace/api-zod` for validation.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `pnpm --filter @workspace/db run push` — push schema changes

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec + Orval codegen config.

- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/schemas
