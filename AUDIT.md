# Farmer's Choice — Code Audit

Date: 2026-10-24 · Commit audited: `e2c8bed` · Scope: whole repo (~7,800 lines of source)

"Confirmed" means the defect is shown by the code itself, or was observed when running it.
"Potential" means the code allows it, but I did not reproduce it.

---

## A. Executive summary

**Overall quality: good for a pilot.** The code is small and readable, with comments that explain *why*. The fundamentals are mostly right:
- OTP codes are salted and hashed, and compared in constant time.
- The JWT guard denies by default.
- Raw SQL is parameterised.
- DTOs whitelist their fields.
- Production refuses to boot with a dev JWT secret.
- The pure logic modules (fertilizer, geo, QR, OTP) have real unit tests, and all 85 pass.

**Production readiness: not ready yet.** Nothing here is CRITICAL, because the shipped mobile app has **no login at all**. The auth API is deployed but no client uses it, which limits the damage of every auth finding. These are the risks that matter:

1. **Production prints sign-in codes to the logs** (`OTP_PROVIDER=console` in `render.yaml`). Anyone with log access can sign in as any phone number. (H1)
2. **The OTP attempt limit and refresh-token rotation are race-prone**, and **suspended users keep access**. (H2, H3, M3)
3. **The safety net has holes.** `npm test` and CI run only 11 of the API's 35 tests. The OTP and QR security tests never run. The CI type check fails on a clean checkout. (H4)
4. **The fertilizer lookup prefers the state-wide row over the district row**, the opposite of what was intended. This is latent until recommendations are loaded. (H6)
5. **Saved land measurements can be wiped** if reading local storage fails once. (H7)

**Architectural concerns:**
- The auth stack is live on a public server that no client uses.
- Each Nest module creates its own PrismaClient, so there are 6 connection pools. (M1)
- The QR counterfeit heuristic can't work as designed. The app never sends location, and anyone can poison a code. (M5)

**Recommended next steps:** fix in this order: H1–H3 and M3 (auth), H4 (CI), H6, H7 and M7 (data correctness), then M1, M2 and M11 (operations). Separately, decide whether login is coming back (I1). That decision changes the priority of several findings.

---

## B. Severity counts

| Severity | Count | Meaning here |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 6 | Fix before real users or real data |
| MEDIUM | 12 | Fix during the pilot |
| LOW | 15 | Fix when touching the area |
| INFO | 7 | Decisions and observations |

---

## C. Detailed findings

### HIGH

**H1 · Production OTP codes are written to logs** — Confirmed
- **Where:** `render.yaml:23` sets `OTP_PROVIDER=console`. `apps/api/src/modules/auth/otp-sender.ts:13-15` logs `DEV OTP for <phone> is <code>`. `apps/api/src/main.ts:6-14` (`requireProdSecrets`) doesn't check the provider.
- **Problem:** in production, every sign-in code is printed in plain text next to the phone number. Real users never receive an SMS.
- **Trigger:** any `POST /v1/auth/otp/request` against the Render deployment.
- **Impact:** anyone who can read Render logs, or any log drain, can take over any account. Phone numbers are PII sitting in the logs.
- **Fix:** refuse to boot when `NODE_ENV=production` and `OTP_PROVIDER !== 'msg91'`. If the auth routes must stay up before DLT registration is done, gate them behind a flag instead:
  ```ts
  if (process.env.OTP_PROVIDER !== 'msg91') throw new Error('Console OTP provider is dev-only');
  ```
- **Verify:** boot with `NODE_ENV=production OTP_PROVIDER=console`; it must exit.

**H2 · Concurrent guesses bypass the 5-attempt OTP limit** — Potential (not reproduced)
- **Where:** `apps/api/src/modules/auth/auth.service.ts:63-81`.
- **Problem:** the code reads the row, checks `attempts < 5` in memory, then increments. N parallel requests all read `attempts = 0` and each gets a guess. Two parallel *correct* submissions can both pass, because the consume step isn't conditional.
- **Trigger:** fire many `otp/verify` requests in parallel for one phone.
- **Impact:** the space is 10⁶ codes. With 3 codes per 15 minutes and unlimited parallel guesses per code, the limit stops being a real bound.
- **Fix:** make both steps atomic in the database:
  ```ts
  // count the attempt first, only while under the limit
  const bumped = await prisma.otpRequest.updateMany({
    where: { id: row.id, attempts: { lt: OTP_MAX_ATTEMPTS }, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count === 0) throw invalid;
  // ...check the code...
  const used = await prisma.otpRequest.updateMany({
    where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() },
  });
  if (used.count === 0) throw invalid;
  ```
- **Verify:** an integration test that sends 20 parallel wrong guesses and expects `attempts ≤ 5` and every request rejected.

**H3 · Suspended users keep their sessions** — Confirmed
- **Where:** `auth.service.ts:95-108` (`refresh`) and `common/jwt-auth.guard.ts:21-25`.
- **Problem:** `blockedAt` is only checked at OTP verify. `refresh()` issues new tokens to a blocked user, and the guard never looks at the user at all.
- **Impact:** a suspension has no effect for up to 30 days, the refresh-token lifetime.
- **Fix:** in `refresh()`, reject when `row.user.blockedAt` is set and revoke all of that user's tokens. Optionally, revoke all refresh tokens at the moment of blocking.
- **Verify:** a unit test where a blocked user's refresh returns 401.

**H4 · Most tests never run, and CI's API type check fails on a clean checkout** — Confirmed
- **Where:** `apps/api/package.json:12` runs `tsx --test src/**/*.test.ts`. npm runs scripts with `sh`, which has no `**`, so the pattern expands to `src/*/*.test.ts` and matches only `src/seed/recommendations.test.ts`. I observed this: `npm test` runs 11 tests. The OTP and QR tests (24 more) are skipped.
- **Also:** `.github/workflows/ci.yml` never runs the `@fc/fert` (22 tests) or `@fc/geo` (26 tests) suites.
- **Also:** `ci.yml:32` type-checks the API without building `@fc/fert` first. Its `main` is `dist/index.js`, so on a clean checkout the check fails with `TS2307: Cannot find module '@fc/fert'`. I observed this locally before building. The README's run steps have the same gap for `npm run api:dev`.
- **Impact:** the security-relevant tests can regress silently. The README claim `npm test # OTP logic` is false.
- **Fix:**
  ```json
  "test": "tsx --test \"src/**/*.test.ts\""
  ```
  Quoted, the pattern is expanded by Node's own glob in Node 22. In CI, add `npm -w @fc/fert run build` before the type check, and run the `fert` and `geo` tests.
- **Verify:** `npm -w @fc/api test` reports 35 tests.

**H6 · Fertilizer lookup prefers the state-wide recommendation over the district one** — Confirmed by code and PostgreSQL semantics (not executed against a DB)
- **Where:** `apps/api/src/modules/fertilizer/fertilizer.service.ts:86`: `orderBy: [{ district: 'desc' }, ...]`.
- **Problem:** PostgreSQL sorts NULLs **first** under `DESC`. The state-wide row (`district = NULL`) therefore beats the district-specific row, which is the opposite of the comment on line 85.
- **Trigger:** both a district row and a state row are PUBLISHED for the same crop, season and irrigation. That's latent today, because 0 recommendations are seeded.
- **Impact:** the farmer gets the wrong agronomic number, and the source citation looks authoritative.
- **Fix:**
  ```ts
  orderBy: [{ district: { sort: 'desc', nulls: 'last' } }, { effectiveDate: { sort: 'desc', nulls: 'last' } }]
  ```
- **Verify:** an integration test that seeds both rows and expects the district one back.

**H7 · One failed storage read wipes every saved land measurement** — Potential
- **Where:** `apps/mobile/src/features/land/storage.ts:61-82`.
- **Problem:** `listMeasurements()` returns `[]` on *any* read or parse error. `saveMeasurement()` and `deleteMeasurement()` then write that empty list back, plus or minus one item.
- **Trigger:** a corrupt value or a transient AsyncStorage error. Android's SQLite-backed AsyncStorage also fails to read a single row larger than about 2 MB. Every measurement lives in one key, so a farmer with many walked boundaries eventually reaches that size.
- **Impact:** permanent, silent loss of all saved land records.
- **Fix:** have the write paths read with a function that **throws** on error, so the write is aborted instead. Keep the forgiving `[]` only for the list screen. Longer term, store one key per measurement.
- **Verify:** a unit test that mocks `getItem` to throw and expects `saveMeasurement` to reject without calling `setItem`.

### MEDIUM

**M1 · Six PrismaClient instances, six connection pools** — Confirmed
- **Where:** `PrismaService` is listed in `providers` in `app.module.ts`, `auth.module.ts`, `users.module.ts`, `locations.module.ts`, `qr.module.ts` and `fertilizer.module.ts`. Each listing creates a new instance.
- **Impact:** each pool defaults to `cpus*2+1` connections, which exhausts Supabase connection limits sooner and gives slower cold boots.
- **Fix:** add one `@Global()` `PrismaModule` that exports `PrismaService`, and remove it from the other modules' `providers`.

**M2 · `/healthz` returns HTTP 200 when the database is down** — Confirmed
- **Where:** `apps/api/src/modules/health/health.controller.ts:16-18` returns `{ ok: false }` with status 200.
- **Impact:** Render treats the service as healthy, which contradicts the comment in `render.yaml`.
- **Fix:** `throw new ServiceUnavailableException({ ok: false, db: 'down' })`.

**M3 · Refresh-token rotation race, on both server and client** — Potential
- **Server:** `auth.service.ts:97-106` does `findUnique`, then an unconditional `update`, so two concurrent refreshes with the same token both succeed.
- **Client:** `apps/mobile/src/lib/api.ts:143-155` refreshes separately for each 401. Two parallel calls after the access token expires race each other, the loser gets 401, and the user is effectively logged out. A failed refresh also never clears the stored tokens.
- **Fix (server):** `updateMany({ where: { id, revokedAt: null } })` and require `count === 1`.
- **Fix (client):** share one in-flight refresh promise between callers.

**M4 · No IP or global rate limiting on public write endpoints** — Confirmed
- **OTP requests:** limited per phone only. `requestIp` is stored but never used, so rotating phone numbers lets anyone pump SMS costs once MSG91 is on. The count-then-insert also races.
- **QR resolve:** `POST /v1/qr/resolve` writes a `QrScan` row for every anonymous request, with no limit.
- **Fix:** `@nestjs/throttler`, applied per IP to these routes. Set Express `trust proxy` so the real client IP is used behind Render.

**M5 · The QR counterfeit heuristic can't work as designed, and can be poisoned** — Confirmed
- **Where:** `apps/mobile/src/screens/ScanScreen.tsx:58` calls `api.resolveQr(data)` with **no coordinates**, so `villageId` is always null and the "3+ districts" rule can never fire. `qr.service.ts:131-150` counts every scan, including repeats from the same device; `deviceId` is stored but ignored.
- **Impact:** one farmer scanning a bag 25 times gets "may be a copied label". Anyone can replay `resolve` 25 times to put that warning on a genuine product.
- **Fix:** count distinct `deviceId`s, rate-limit per device and IP (M4), and either send a coarse location or drop the district rule.

**M6 · Mobile client crashes on non-JSON error pages** — Confirmed
- **Where:** `api.ts:133-134`: `JSON.parse(text)` runs before the `res.ok` check.
- **Trigger:** Render returns an HTML 502 or 503 page during free-tier cold starts.
- **Impact:** a `SyntaxError` reaches the screens, which show "offline" or a generic error.
- **Fix:** wrap the parse in `try`; on failure, throw `ApiError(res.status, 'Server unavailable')`.

**M7 · The fertilizer schedule silently drops products** — Potential (depends on data)
- **Where:** `packages/fert/src/engine.ts:190-209` and `validate.ts:67-74`.
- **Problem:** a product is split by its principal nutrient's share. If the published schedule gives that nutrient no share in any stage (sum = 0), the product disappears from the timing table. The validator only checks sums when `sum > 0`.
- **Fix:** have the validator reject a schedule in which a nutrient with a non-zero requirement has shares summing to 0. Alternatively, treat that nutrient as fully basal.

**M8 · The land screen thinks it's offline whenever the API is slow** — Confirmed
- **Where:** `apps/mobile/src/features/land/LandScreen.tsx:65` decides whether map tiles can load by pinging *our API* with a 6-second timeout.
- **Problem:** a Render free-tier cold start takes longer than that. The screen then shows the "offline" banner and forces walk mode, even though the internet works.
- **Fix:** test general connectivity instead (`expo-network`'s `getNetworkStateAsync`), or don't force the mode.

**M9 · A self-intersecting boundary can be saved** — Confirmed
- **Where:** `LandScreen.tsx:296` disables Save only when there are fewer than 3 points. A crossing boundary shows a warning but still saves.
- **Impact:** the geodesic area of a figure-8 shape is the difference between its two loops, so the recorded area is wrong.
- **Fix:** disable Save while `b.selfIntersecting`, or ask for confirmation. This is a product decision.

**M10 · Production seed still loads fabricated QR tags** — Confirmed
- **Where:** `apps/api/prisma/seed-all.ts:18` runs `seed-qr.ts`, which contains demo "genuine" batches, a "recalled" batch and an equipment owner named "Ramesh Kumar". `DEPLOY.md` step 3 tells deployers to run `seed-all`.
- **Problem:** commit `5bab5b9` removed these tags precisely because they "would mislead anyone who scanned one".
- **Fix:** delete `seed-qr.ts` and remove it from `seed-all.ts` and `DEPLOY.md`.

**M11 · Vulnerable API runtime dependencies** — Confirmed by `npm audit --omit=dev`
- **What:** `@nestjs/platform-express` and `@nestjs/core` 10.4.22 pull in flagged `body-parser`, `multer`, `path-to-regexp` and `qs`.
- **Exposure:** multer is unreachable (there are no upload routes), and the body-parser issue needs a misconfigured `limit`. Real-world exposure is low, but the fixes are only on Nest 11.
- **Mobile:** the flagged packages (`@expo/cli`, `node-forge`, `shell-quote`, `zod`) are build-time tooling and don't ship in the APK.
- **Fix:** plan the Nest 10 → 11 upgrade. **Don't** run `npm audit fix --force`, which proposes downgrading Expo to 44.

**M12 · Personalised ads with no consent flow** — Potential compliance risk
- **Where:** `apps/mobile/src/lib/ads.ts:69` sets `requestNonPersonalizedAdsOnly: false`, and there's no UMP or consent prompt anywhere.
- **Risk:** India's DPDP Act and Google Play's Data safety rules expect disclosure and consent.
- **Fix:** request non-personalised ads until a consent flow exists.

### LOW

| ID | Finding | Where | Fix |
|---|---|---|---|
| L1 | `photoUrl` accepts any string of any length and is shown on the public profile | `users.controller.ts:9` | `@IsUrl({ protocols: ['https'] }) @MaxLength(500)` |
| L2 | `/locations/resolve` doesn't range-check lat/lng; out-of-range values make PostGIS error, which returns 500 | `locations.controller.ts:15-22` | Validate with a DTO using `@IsLatitude`/`@IsLongitude` |
| L3 | `JWT_REFRESH_TTL` in `.env.example` is ignored; the code hardcodes 30 days | `auth.service.ts:125` | Read it from config, or delete it from `.env.example` |
| L4 | The MSG91 `fetch` has no timeout, so a hung SMS provider hangs the request | `otp-sender.ts:32` | `signal: AbortSignal.timeout(10_000)` |
| L5 | `OtpRequest`, `RefreshToken` and `QrScan` are never pruned. QrScan keeps precise GPS of anonymous scans indefinitely | schema | Add a scheduled cleanup and a retention policy |
| L6 | No GiST index on `Location.centroid`; `ILIKE '%q%'` search can't use the btree index | migrations | Add `CREATE INDEX ... USING gist (centroid)` and `pg_trgm` when the village count grows |
| L7 | Nothing stops two PUBLISHED recommendations for the same key, so the lookup result becomes arbitrary | schema | Add a partial unique index `WHERE status='PUBLISHED'` |
| L8 | "Open link" opens the sanitised `display` string, which is cut at 200 characters, so it can open a different URL than the QR holds | `qr-code.ts:103-145`, `ScanScreen.tsx:303` | Return a separate full `href` (`u.href`) for opening |
| L9 | Walk mode: the GPS callback captures a stale `b`, so the undo history fills with the pre-walk snapshot. `startWalk` has no error handling, and a double tap leaks a GPS watcher | `LandScreen.tsx:109-124` | Guard re-entry, wrap in try, and use a functional update or a ref |
| L10 | The scan result shows hardcoded English labels ("Manufacturer", "Batch", "Owner") and raw outcome codes in a Telugu-first app | `ScanScreen.tsx:249-256, 350` | Move them into the i18n files |
| L11 | Stale references to Telangana: the default map region is Ghatkesar, plus comments in i18n and locations | `LandScreen.tsx:23`, `i18n/index.ts:13` | Use Guntur coordinates |
| L12 | Home header text is clipped: the village and weather labels are cut to "లాం" and "ఎండ" (seen on the emulator) | `HomeScreen.tsx` header | Let the meta column wrap or shrink |
| L13 | Every return to Home re-requests GPS, weather and village; the weather fetch has no timeout | `HomeScreen.tsx:51-65`, `weather.ts:26` | Cache per session and add `AbortSignal.timeout` |
| L14 | The district is free text matched exactly and case-sensitively, so "guntur" silently falls back to the state-wide row | `FertilizerScreen.tsx`, `fertilizer.service.ts:83` | Use a picker from the location tree, or `mode: 'insensitive'` |
| L15 | Area conversion constants are duplicated in `@fc/fert` and `@fc/geo`, although geo says "nowhere else" | `fert/engine.ts:6-12` | Import them from `@fc/geo` |

### INFO

- **I1:** the login flow is dead code in the app, while its API is live. `PhoneScreen`, `OtpScreen`, `NameScreen`, `VillageScreen`, `LanguageScreen` and `ComingSoonScreen`, plus `api.me`, `api.updateMe` and `saveTokens`, are never imported (`App.tsx` says "No login"). The full auth stack still runs on the production API. Either take the auth routes off production until login returns, or wire it back. Until then, H1–H3 and M3 only affect an unused surface.
- **I2:** no linter or formatter is configured.
- **I3:** `usesCleartextTraffic: true` is still set (`app.json:35`), although production is HTTPS. `DEPLOY.md` step 5 says to remove it.
- **I4:** `SEED_ON_BOOT=true` is committed in `render.yaml:25`. It's idempotent but slows every boot.
- **I5:** CORS allows every origin when `CORS_ORIGINS` is unset. Auth is by bearer token and there's no browser client, so the practical risk is low.
- **I6:** tokens would sit in unencrypted AsyncStorage. That's moot while login is unused; switch to `expo-secure-store` if login returns.
- **I7:** good practices worth keeping: salted, hashed OTPs with constant-time compare; deny-by-default guard; parameterised raw SQL; DTO `whitelist` and `forbidNonWhitelisted`; a production secret check at boot; QR codes are opaque IDs and are never auto-opened; non-ASCII and punycode hosts are flagged; no fabricated agronomic numbers.

---

## D. File-by-file review

| File | Purpose | Findings |
|---|---|---|
| `apps/api/src/main.ts` | Bootstrap, validation, CORS | H1 (no provider check), I5 |
| `apps/api/src/app.module.ts` | Root module, global guard | M1 |
| `modules/auth/auth.service.ts` | OTP and token lifecycle | H2, H3, M3, M4, L3 |
| `modules/auth/otp.ts` | Pure OTP rules | Clean; tests exist but don't run (H4) |
| `modules/auth/otp-sender.ts` | Console and MSG91 delivery | H1, L4 |
| `common/jwt-auth.guard.ts` | Global auth guard | H3 |
| `modules/users/*` | `/me`, public profile | L1 |
| `modules/locations/*` | Village search and GPS lookup | L2, L6 |
| `modules/qr/*` | QR resolve and heuristic | M4, M5, L8 |
| `modules/fertilizer/*` | Calculator endpoint | H6, L14 |
| `modules/health/health.controller.ts` | Health check | M2 |
| `prisma/schema.prisma` and migrations | Data model | L5, L6, L7; schema and migrations match (checked by hand) |
| `prisma/seed*.ts`, `src/seed/*` | Reference data | M10 |
| `packages/fert/src/*` | Blend engine and validator | M7, L15 (and a latent edge in `rankBlends`, see note) |
| `packages/geo/src/*` | Area and GPS filtering | Clean, well tested |
| `apps/mobile/App.tsx` | Step-based navigation | I1 |
| `src/lib/api.ts` | HTTP client | M3, M6 |
| `src/lib/ads.ts`, `components/AdBanner.tsx` | AdMob | M12 |
| `src/screens/ScanScreen.tsx` | QR scanner | M5, L8, L10 |
| `src/screens/HomeScreen.tsx` | Home | L12, L13 |
| `src/features/land/*` | Boundary measurement | H7, M8, M9, L9, L11 |
| `src/features/fertilizer/*` | Calculator UI | L14 |
| `.github/workflows/ci.yml`, `apps/api/package.json` | CI and test scripts | H4 |
| `render.yaml`, `Dockerfile`, `DEPLOY.md` | Deployment | H1, I4, M10 |

**Note on `rankBlends`** (`engine.ts:155-157`): if a nutrient is needed but none of the given products supplies it, the outer loop runs zero times and *no* blend is returned, rather than a blend with a shortfall. This is latent, because the app never sends `productKeys` (so every active product is considered). Fix it with `pSources.length ? pSources : [undefined]`, and the same for K and N.

**Read only partly or skimmed:** `Results.tsx`, `MeasurementPanel.tsx`, `SavedScreen.tsx`, `TabBar.tsx`, `ui.tsx`, the i18n JSON files, `tools/stt-pilot.mjs`, and the test files. These were checked for patterns, not line by line.

**Not inspected:** the generated `apps/mobile/android/` folder (it comes from `expo prebuild`) and `node_modules`.

---

## E. Risk prioritisation

| # | Issue | Severity | File | Action |
|---|---|---|---|---|
| 1 | H1 OTP codes in production logs | HIGH | `render.yaml`, `main.ts` | Boot guard, or take auth routes off production |
| 2 | H4 Tests not running; CI broken | HIGH | `apps/api/package.json`, `ci.yml` | Quote the glob, build fert, add fert and geo tests |
| 3 | H2 OTP attempt race | HIGH | `auth.service.ts` | Atomic `updateMany` |
| 4 | H3 Blocked users keep sessions | HIGH | `auth.service.ts` | Check `blockedAt` on refresh |
| 5 | H7 Land data wipe | HIGH | `storage.ts` | Throw on read error in write paths |
| 6 | H6 District-vs-state ordering | HIGH | `fertilizer.service.ts` | `nulls: 'last'` |
| 7 | M10 Fake QR tags in seed | MED | `seed-all.ts` | Delete `seed-qr` |
| 8 | M1 Six Prisma pools | MED | `*.module.ts` | Global PrismaModule |
| 9 | M2 Health 200 on DB down | MED | `health.controller.ts` | Return 503 |
| 10 | M3 Refresh race | MED | `auth.service.ts`, `api.ts` | Conditional update and a single in-flight refresh |
| 11 | M4, M5 Rate limits and QR heuristic | MED | `qr.*`, `auth.*` | Throttler, distinct devices |
| 12 | M6, M8 Cold-start handling in app | MED | `api.ts`, `LandScreen.tsx` | Safe parse, real connectivity check |
| 13 | M12 Ads consent | MED | `ads.ts` | Non-personalised only |
| 14 | M7, M9 Schedule and polygon correctness | MED | `engine.ts`, `LandScreen.tsx` | Validator rule; block or confirm save |
| 15 | M11 Nest 11 upgrade | MED | `apps/api/package.json` | Planned upgrade |
| 16+ | LOW items | LOW | various | Fix when touching the area |

---

## F. Testing results (all observed)

| Check | Command | Result |
|---|---|---|
| API tests (as scripted) | `npm -w @fc/api run test` | 11/11 pass. **Runs only `recommendations.test.ts`** (H4) |
| API OTP and QR tests (run directly) | `npx tsx --test src/modules/auth/otp.test.ts src/modules/qr/*.test.ts` | 24/24 pass |
| Fertilizer engine | `npm -w @fc/fert run test` | 22/22 pass |
| Geo | `npm -w @fc/geo run test` | 26/26 pass |
| Mobile API helper | `npx tsx --test src/lib/api.test.ts` | 3/3 pass |
| API type check, clean tree | `npx tsc --noEmit` | **Fails**: TS2307 `@fc/fert` not built (H4) |
| API type check, after building fert | same | Pass |
| Mobile type check | `npx tsc --noEmit` | Pass |
| fert and API builds | `npm run build` | Pass |
| Android debug build | `expo run:android` | Pass. Installed and launched on the Pixel_9 emulator; the Telugu home screen renders with live weather |
| `npm audit --omit=dev` | — | 22 advisories (1 critical, 13 high, 8 moderate), mostly build-time Expo tooling (M11) |
| Lint | — | Not run: no linter configured (I2) |
| DB integration tests | — | **Not run**: none exist. H2, H6 and M3 need them; Docker is available to add them |
| API running end to end | — | **Not run**: no local Postgres was started this session |

**Gaps that remain:** no integration tests against Postgres, no tests for UI components, and the race conditions (H2, M3) haven't been reproduced.

---

## G. Fix log

### Group 1: auth (H1, H2, H3, M3). Branch `audit-fixes`, not committed.

| ID | Change | Evidence |
|---|---|---|
| H1 | `otpSenderFor()` (`otp-sender.ts`) returns a `DisabledOtpSender` when `NODE_ENV=production` and the provider isn't msg91. Sign-in then returns 503, and **no code is ever logged**. Booting still works, so QR, fertilizer and locations keep serving | Unit test |
| H2 | `verifyOtp` counts the attempt with a conditional `updateMany` (`attempts < 5`) before checking the code, and consumes it conditionally | 20 parallel wrong guesses leave `attempts = 5`, and the right code is then refused. **This failed on the old code**, which reproduced the bug |
| H3 | `refresh()` rejects a blocked user and revokes all their refresh tokens | **Failed on the old code** |
| M3 (server) | Token rotation is a conditional `updateMany`; only one concurrent refresh can succeed | 3 parallel refreshes give exactly 1 success. **Failed on the old code** |
| M3 (client) | `api.ts` shares one in-flight refresh, and clears tokens when the refresh token is rejected | Type check only. The module imports react-native at load time, and this path is unreachable while login is unused (I1) |

New tests are in `apps/api/src/modules/auth/auth.service.test.ts`. They run against real Postgres and skip when `DATABASE_URL` isn't set.

**Not changed:** the access-token guard still doesn't check `blockedAt`. Access tokens last 15 minutes, so a suspension takes effect within 15 minutes. Checking it in the guard would cost a database read on every request.

### Group 2: tests and CI (H4)

| Change | Evidence |
|---|---|
| The API and mobile `test` scripts quote their globs, so Node expands `**` itself | The API suite went from 11 to 40 tests |
| Root `npm test` builds `@fc/fert`, then runs every workspace's tests | Observed: 40 + 3 + 22 + 26 = 91 tests, all passing, after deleting `packages/fert/dist` |
| CI builds `@fc/fert` before the API type check, then runs root `npm test` | Not run on GitHub; the same commands were run locally |
| README test section corrected | — |

### Group 3: data correctness (H6, H7, M7, M10)

| ID | Change | Evidence |
|---|---|---|
| H6 | The lookup orders by `district` and `effectiveDate` with `nulls: 'last'` | Postgres test: a Guntur request returns the district row (150), and no district returns the state row (100). **On the old code Guntur got 100**, which reproduced the bug |
| H7 | `storage.ts`: the save and delete paths read through `readAll()`, which throws, so a failed read aborts the write. The list screen still falls back to `[]`. Save and delete failures show an alert, and the boundary stays on screen | 3 unit tests (AsyncStorage mocked). **2 failed on the old code** |
| M7 | Both validators (the API seed `validate()` and `@fc/fert` `validateRecommendation`) reject a schedule in which a required nutrient has no stage share | 2 tests. **Both failed on the old code** |
| M10 | Deleted `prisma/seed-qr.ts` and removed it from `seed-all.ts`. `DEPLOY.md` now says no tags are seeded, and gives the SQL to remove `DEMO%` tags from a database seeded earlier | — |

**Production data not touched:** if the live database was seeded with `seed-all.ts` before this change, the 4 demo tags are still there. Run the SQL in `DEPLOY.md` to remove them.

### New finding from runtime testing

**M13 · The app crashes opening Land measurement when built without a Maps key** — Confirmed on the emulator
- **Where:** `apps/mobile/app.config.js` passes `EXPO_PUBLIC_GOOGLE_MAPS_KEY` through without checking it. When the variable is empty, `expo prebuild` leaves the `com.google.android.geo.API_KEY` entry out of the manifest.
- **What happens:** opening the land screen kills the app with `IllegalStateException: API key not found`. Any APK built on a machine without the variable, including a release, ships this crash.
- **Fix:** have `app.config.js` fail the build when the key is missing, or at least warn. Set the key in `apps/mobile/.env` for local builds.
- **Note:** this is unrelated to the H7 change. The land screen couldn't be exercised in the emulator for that reason, so H7 is covered by its unit tests only.

### M13 fix

`app.config.js` throws when `EXPO_PUBLIC_GOOGLE_MAPS_KEY` is missing and the command generates the native project (`prebuild`, `run:android`, `run:ios`, or an EAS build). `expo start` still works without a key.

**Verified:**
- `expo prebuild` and `expo run:android` without the key stop with the message.
- `expo config` without the key passes.
- With a key, the config loads.

**Gap:** `npm run build:apk` calls Gradle directly on an existing `android/` folder, so it bypasses this check. Run prebuild with the key first.

### Real data only, and permissions asked when needed

- **No demo villages:** `prisma/seed.ts`, `src/seed/run.ts` and `src/seed/data.ts` no longer create the location tree. Locations come only from a real LGD import. Crops and fertilizer product specs (reference facts) are still seeded. `DEPLOY.md` has SQL to remove demo villages from a database seeded earlier.
- **Home place name:** comes from the phone's own geocoder (`Location.reverseGeocodeAsync`) instead of the demo village table. Note that the geocoder returns names in the phone's language, not the app's.
- **Fresh location:** the Home screen prefers a fix newer than 10 minutes and waits up to 15 seconds for one. Only then does it fall back to the last known fix; previously it would wait forever.
- **Weather icon:** follows the WMO code and day or night (a moon on a clear night) instead of a fixed sun. A clear night is no longer labelled "sunny".
- **Permissions:**
  - **Home:** asks for location the first time it opens. After a "no", the header shows a tappable "allow location" link, which opens Settings if the user chose "don't ask again".
  - **Scanner:** asks for the camera as soon as it opens.
  - **Land measurement:** keeps its explanation screen before asking.
- **Verified on the emulator:** the location prompt, the deny path with its link, the grant path showing "Guntur · 27°C clear (moon)" against Open-Meteo's `27.3°C, code 0, is_day 0`, and the camera prompt.

### Simple fertilizer calculator (v1.0.2)

- The calculator is now **product × dose per acre × land = total kg and bags**. Urea uses 45 kg bags; DAP, MOP, SSP and complexes use 50 kg; the bag size can be changed. The farmer enters the dose from their soil card or agriculture officer.
- It works offline and calls no server.
- The crop-recommendation flow (`Results.tsx`, `states.ts`) and the app's calls to the `/v1/fertilizer/*` API were removed. The API and the `@fc/fert` engine remain on the server, unused by the app.
- Tests: `apps/mobile/src/features/fertilizer/dose.test.ts`.
- Verified on the emulator with the release APK: Urea, 50 kg/acre, 2.5 acres gives 125 kg = 2 × 45 kg + 35 kg.
