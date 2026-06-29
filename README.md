# TaskFlow — Team Task Management, Simplified.

A full-stack SaaS task management app built as a portfolio project. Features JWT authentication, multi-tenant workspaces, RBAC, real-time Kanban boards, comments, notifications, file uploads, and full-text search.

**Stack:** Node.js · Express · Prisma · PostgreSQL · Socket.IO · React · Vite · Tailwind · Docker

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────┐
│   Browser   │────▶│  Nginx (:80)             │
│  React SPA  │     │  /          → Frontend   │
└─────────────┘     │  /api/*     → Backend    │
                    │  /socket.io → Backend WS │
                    │  /uploads   → Backend    │
                    └──────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Express (:3000)    │
                    │  ┌──────────────┐   │
                    │  │ Socket.IO    │   │
                    │  │ (auth+rooms) │   │
                    │  └──────────────┘   │
                    │  ┌──────────────┐   │
                    │  │ Prisma ORM   │   │
                    │  └──────┬───────┘   │
                    └─────────┼───────────┘
                              │
                    ┌─────────┴───────────┐
                    │  PostgreSQL :5432   │
                    │  Redis :6379        │
                    └─────────────────────┘
```

## Quick Start (Development)

```bash
# 1. Start databases
docker compose up -d

# 2. Install dependencies
npm install

# 3. Run migrations
cp .env.example .env
npm run db:migrate

# 4. Start dev servers
npm run dev
# Backend:  http://localhost:3000
# Frontend: http://localhost:5173
```

## Quick Start (Production — Docker)

```bash
# 1. Configure environment
cp .env.production.example .env
# Edit .env — fill in JWT secrets and any OAuth keys

# 2. Start the full stack
JWT_ACCESS_SECRET=your-64-char-secret \
JWT_REFRESH_SECRET=your-64-char-secret \
POSTGRES_PASSWORD=strong-password \
  docker compose -f docker-compose.prod.yml up -d

# 3. Visit http://localhost
```

## Project Structure

```
taskflow/
├── packages/
│   ├── shared/          # @taskflow/shared — types, Zod schemas, constants
│   ├── backend/         # @taskflow/backend — Express + Prisma + Socket.IO
│   └── frontend/        # @taskflow/frontend — Vite + React + Tailwind
├── nginx/nginx.conf     # Reverse proxy (production)
├── docker-compose.yml       # PostgreSQL + Redis (dev)
├── docker-compose.prod.yml  # Full production stack
├── Dockerfile.backend       # Multi-stage Node.js build
├── Dockerfile.frontend      # Multi-stage React → NGINX build
├── .github/workflows/ci.yml # CI: lint → typecheck → test
└── docs/                    # Phase-by-phase learning guides
```

## Features by Phase

| Phase | Feature | Docs |
|-------|---------|------|
| 0 | Scaffolding: monorepo, Docker, Prisma, Vite | [docs/phase-0](docs/phase-0-scaffolding.md) |
| 1 | Auth: JWT dual tokens, OAuth2, token rotation | [docs/phase-1](docs/phase-1-authentication.md) |
| 2 | Workspaces: multi-tenant, RBAC, invitations | [docs/phase-2](docs/phase-2-workspaces.md) |
| 3 | Kanban: drag-and-drop, position reordering, optimistic updates | [docs/phase-3](docs/phase-3-kanban.md) |
| 4 | Real-time: Socket.IO rooms, presence, event-driven cache | [docs/phase-4](docs/phase-4-realtime.md) |
| 5 | Comments + Notifications: threaded discussions, auto-notify | [docs/phase-5](docs/phase-5-comments-notifications.md) |
| 6 | File Uploads: multer, drag-and-drop, storage abstraction | [docs/phase-6](docs/phase-6-file-uploads.md) |
| 7 | Search: PostgreSQL tsvector, GIN index, Cmd+K palette | [docs/phase-7](docs/phase-7-search.md) |
| 8 | Testing + UX: 28 tests, skeletons, error boundary | [docs/phase-8](docs/phase-8-testing-ux.md) |
| 9 | Deployment: Docker multi-stage, Nginx, CI/CD, docs | [docs/phase-9](docs/phase-9-deployment.md) |

## API Overview

| Module | Base | Key Endpoints |
|--------|------|---------------|
| Auth | `/api/auth` | register, login, refresh, logout, OAuth |
| Users | `/api/users` | /me, /me/avatar |
| Workspaces | `/api/workspaces` | CRUD, members, invitations |
| Projects | `/api/workspaces/:wid/projects` | CRUD + task counts |
| Tasks | `/api/projects/:pid/tasks` | CRUD + /by-status + status/position update |
| Comments | `/api/tasks/:tid/comments` | CRUD |
| Attachments | `/api/tasks/:tid/attachments` | Upload, download, delete |
| Search | `/api/search` | Full-text with highlights |
| Notifications | `/api/notifications` | List, unread-count, mark-read |

All responses follow `{ data, meta? }` success / `{ error: { code, message } }` error format.

## Environment Variables

See [.env.example](.env.example) for development and [.env.production.example](.env.production.example) for production.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | JWT signing key (64 hex chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key |
| `FRONTEND_URL` | Yes | CORS origin (e.g. http://localhost:5173) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth2 app ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth2 secret |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app secret |
| `SMTP_HOST` | No | SMTP server for invites |
| `UPLOAD_DIR` | No | File storage directory (default: ./uploads) |
| `REDIS_URL` | No | Redis connection (default: localhost:6379) |

## Running Tests

```bash
# All tests
npm test

# Backend only
npm -w packages/backend test

# Frontend only
npm -w packages/frontend test
```

## Deployment to VPS

```bash
# On your server:
git clone <repo> taskflow && cd taskflow
cp .env.production.example .env
# Edit .env with real secrets

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations (already auto-ran by entrypoint, but manual if needed)
docker exec taskflow-backend npx -w packages/backend prisma migrate deploy
```

## License

MIT — use this as your own portfolio template.
