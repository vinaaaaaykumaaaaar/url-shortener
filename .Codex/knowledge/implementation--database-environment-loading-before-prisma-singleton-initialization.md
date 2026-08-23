---
title: Database Environment Loading Before Prisma Singleton Initialization
type: implementation
confidence: 1.0
related_files:
  - packages/shared/config/env.ts
  - packages/shared/db/client.ts
  - apps/write-server/src/server.ts
tags:
  - prisma
  - postgresql
  - environment
  - startup
---

## Summary

The shared Prisma singleton must load the repository-level `.env` before reading `DATABASE_URL`.
This is necessary when a service is launched from a nested workspace directory where Bun does not
automatically discover the root `.env` file.

## Details

`packages/shared/db/client.ts` is evaluated while shared-module imports are being resolved, before
the write server calls `loadConfig()`. If the current working directory is
`apps/write-server`, `DATABASE_URL` is initially absent. Constructing `PrismaPg` at that point makes
its lazy pool fall back to the PostgreSQL defaults; the first real query then fails with
`ECONNREFUSED` even though `loadConfig()` has populated `process.env` in the meantime.

The database client now calls the shared upward-searching `loadEnvFile()` before it reads
`DATABASE_URL`. The write-server startup also executes `SELECT 1` instead of relying on
`prisma.$connect()`, because the adapter pool is lazy and `$connect()` alone did not demonstrate
that the configured database was reachable.

## Key Decisions

- **Keep one exported Prisma client**: The application retains its simple singleton design rather
  than introducing a database factory or passing a client through `AppDependencies`.
- **Load configuration at the client boundary**: Every import path that reaches the singleton gets
  a correctly initialized adapter, regardless of the process working directory.
- **Probe with a real query before listening**: The HTTP server must not report that it is listening
  until PostgreSQL has accepted a query.

## Constraints

- `DATABASE_URL` must be present in the process environment or in a `.env` file discoverable by
  `loadEnvFile()` before the Prisma adapter is constructed.
- Do not replace the startup `SELECT 1` probe with only `prisma.$connect()` while using the lazy
  `PrismaPg` adapter.
- Never log the database connection string or credentials while diagnosing connection failures.
