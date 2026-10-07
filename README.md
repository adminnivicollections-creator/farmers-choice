# Farmer's Choice

India-first farmer super app — buy inputs, rent equipment, ask the village.
Pilot scope: Guntur district, Andhra Pradesh. Telugu-first.

Architecture and phasing: see the architecture document shared with the team.

## Phase 1 — done

Identity and place. A farmer picks a language, signs in with an OTP, gives a
name, and picks a village. Verified end to end on an Android emulator.

| Piece | Where |
|---|---|
| API (NestJS modular monolith) | `apps/api` |
| Mobile (Expo / React Native) | `apps/mobile` |
| Design tokens | `packages/tokens` |
| Postgres 16 + PostGIS + btree_gist | `infra/docker/compose.yml` |
| Telugu STT pilot harness | `tools/` |

## Run it

    cp .env.example .env
    npm install
    npm run db:up
    npm -w @fc/api run prisma:generate
    cd apps/api && npx prisma migrate deploy && npm run seed && cd ../..
    npm run api:dev          # http://localhost:3000

    cd apps/mobile && npx expo run:android

The app reaches the API at `10.0.2.2:3000` on an Android emulator. Override
with `EXPO_PUBLIC_API_BASE` for a physical device.

## OTP in development

`OTP_PROVIDER=console` prints the code to the API log instead of sending SMS:

    [OTP] DEV OTP for +919876543210 is 123456

Real SMS needs MSG91 **and** DLT template registration with TRAI — that is a
one-to-three week lead time and nothing in code can shortcut it.

## Known limits

- Location codes below state level are `DEMO-*` placeholders, **not** real LGD
  codes. Andhra Pradesh's state code (28) is real; everything under it is not.
  Replace from https://lgdirectory.gov.in before the pilot. AP was reorganised
  into 26 districts in 2022, so any older district list is wrong. See
  `apps/api/prisma/seed.ts`.
- **No fertilizer recommendations are seeded, by design.** The calculator
  reports "unavailable" until sourced data is loaded through the admin
  workflow. The authority for Andhra Pradesh is ANGRAU.
- Village centroids are hand-placed, accurate to roughly a kilometre.
- `npm` workspaces, not pnpm (global pnpm install needed sudo on the dev machine).
- The server runs under `ts-node`, not `tsx`: esbuild does not implement
  `emitDecoratorMetadata`, which silently breaks every Nest DI constructor.

## Tests

    npm test                 # OTP logic
    cd apps/api && npx tsc --noEmit
    cd apps/mobile && npx tsc --noEmit
