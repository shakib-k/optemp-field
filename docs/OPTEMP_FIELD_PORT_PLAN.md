# OPTemp Field — Port Plan

**Status:** draft for review. No code written yet.
**Supersedes:** `optemp-garden_FORK_PLAN.md` (Apr 2026) and `Optemp_Phase2A_Strategy_Update.md` (May 2026), both of which describe the biology faculty tour that `bio-tour` went on to build and field.

---

## 0. Decisions locked

| Decision | Value | Why |
|---|---|---|
| Repo | **new repo, fresh git history** — working name `optemp-field` | Public research repo with no visible or historical relation to `bio-tour`. Not a GitHub fork. |
| Language | **TypeScript** | The infrastructure being reused is already TS and typed; schema drift across two semesters gets caught at compile time. |
| Local store | **Dexie** (IndexedDB) | Proven on 88 participants. |
| Cloud | **Firebase**, own project | Provider choice is deferred, not settled — see §7. Isolated behind two modules so it stays swappable. |
| `optemp-garden` | **left alone** | It is a stalled predecessor of `bio-tour`, not a base. Not deleted, not built on. |
| `bio-tour` | **untouched** | Nothing is pushed to it, nothing is forked from it. Code moves out by copy-and-adapt only. |

### The exclusion line — non-negotiable

`bio-tour` is 100% Shakib-authored (47/47 commits), so reusing its *infrastructure* is reusing his own work. The faculty's stake is **content**, and none of it crosses:

**NEVER crosses into `optemp-field`:**
- `src/lib/tour/content.ts` (1,239 lines of biology station text and quiz items)
- `public/tour-images/` (20 MB of faculty station photography)
- `src/lib/tour/media.ts` (station photo + approach-directions mapping)
- `src/components/garden/FirstLegMap.tsx`, `PinchZoomImage.tsx` (faculty map assets)
- `src/components/garden/FinalQuestion.tsx` (the evolutionary-sequence sort)
- Anything naming the Biology Faculty, Moodle, or the faculty Google Form

This line is checked once at scaffold time and once before the first public push.

---

## 1. Port manifest

Four verdicts: **PORT** (copy, retype imports only) · **ADAPT** (copy, then change for research needs) · **NEW** (write from scratch) · **NEVER** (see above).

### Data layer

| bio-tour file | Verdict | Note |
|---|---|---|
| `lib/db/dexie.ts` | **ADAPT** | Keep the class shape, the versioned `.upgrade()` pattern, `AtomicTimestamp`, the discriminated event union. Replace tour-specific tables and event kinds with the research protocol (§2). |
| `lib/db/session.ts` | **ADAPT** | Keep the active-session-pointer split from saved progress. Replace `getOrCreateDeviceId` with the real participant code (§3). |
| `lib/sync/pushAttempts.ts` | **PORT** | Best asset in the codebase. Batched writes at 400/batch, `flushInFlight` re-entrancy guard, deferred `scheduleFlush` out of the Dexie `creating` hook, doc id = local UUID so retries are idempotent, `useSyncExternalStore` snapshot for the UI. Rename to `lib/sync/push.ts`. |
| `lib/firebase/client.ts`, `admin.ts` | **PORT** | The provider boundary. |
| `lib/env.ts`, `env.server.ts` | **PORT** | |
| `lib/types/attempt.ts` | **ADAPT** | `Attempt` generalises to a research `Response`; `outcome: "correct" \| "incorrect"` no longer fits a thermal rating (§2). |
| `lib/types/participant.ts` | **ADAPT** | Gains the code state machine (§3). |
| `lib/types/tour.ts` | **NEW** | Replaced by the protocol schema (§2). The bilingual `_he`/`_en` parallel-field convention and the `noUncheckedIndexedAccess` contract carry over. |
| `firestore.rules` | **ADAPT** | See §4 — bio-tour's rules are `read: if true` and must not ship in a research app. |
| `firestore.indexes.json`, `firebase.json` | **ADAPT** | |

### Hooks and shell

| bio-tour file | Verdict |
|---|---|
| `hooks/useWakeLock.ts` | **PORT** — screen must stay awake through a station dwell |
| `hooks/useOnlineStatus.ts` | **PORT** |
| `hooks/useSyncState.ts` | **PORT** |
| `components/StorageGuard.tsx` | **PORT** — also the natural home for the iOS Safari/A2HS storage check (§6) |
| `components/SyncStatus.tsx` | **PORT** |
| `components/garden/StationValidator.tsx` | **ADAPT** → `ArrivalGate` — the "I'm here" manual tap, no QR, no GPS |
| `components/garden/ActivityRunner.tsx` | **ADAPT** → `StepRunner` — keep the one-micro-state-at-a-time drive loop, the shuffled-option-indices helper, the per-path progress reads/writes. Drop the faculty copy blocks. |
| `components/onboarding/WelcomeGate.tsx` | **ADAPT** — becomes code entry, not open-tour entry |
| `components/garden/CompletionScreen.tsx` | **ADAPT** — no Moodle code |
| `context/ThemeContext.tsx`, `TabNavContext.tsx` | **PORT** |
| `scripts/firestore-backup.mjs`, `firestore-export-csv.mjs`, `firestore-wipe.mjs` | **PORT** — the backup script is what produced the recoverable minducate snapshot |

### From `optemp-minducate`

| File | Verdict |
|---|---|
| `src/components/thermal/ThermalRating.js` | **ADAPT** → `steps/ThermalRatingStep.tsx`. TSV/TCV sliders + clothing layers, converted to TS, emitting a `rating_probe` response. **Blocked on the TCV scale decision (§7).** |
| `src/components/minducate/ThermalPhase.js` | **REFERENCE** — read for the pre/post sequencing, do not copy |
| `src/lib/localDB.js`, `syncEngine.js` | **NEVER** — superseded by the Dexie + push layer |
| `src/lib/offlineQueue.js` | **NEVER** — see §5 |
| `firestore-backups/.../allowed_codes.json` | **REFERENCE** — 11 docs, shape `{ _docId: "3599", active: true }` (§3) |

### From `optemp`

Cognitive tasks (BART, mixed gambles) — **deferred to a later PR**, ported as step types once the protocol layer is stable. `src/lib/offlineQueue.js` never crosses.

---

## 2. Schema design

### Protocol-as-data

The experiment lives in a content file, not in components. An ordered list of typed steps, each anchored to a physical spot:

```
type StepKind =
  | "instruction"     // static beat, no submission
  | "arrival_gate"    // "I'm here" manual tap — no QR, no GPS
  | "rating_probe"    // TSV / TCV / distractor sliders
  | "dwell"           // timed thermal exposure; reading time IS the exposure
  | "quiz"            // knowledge item, difficulty-balanced across microclimates
  | "task_block"      // cognitive task (deferred)
```

**The gap bio-tour does not cover:** its `activities[]` hangs off a station, one group per station. Station 1 has two benches in opposite microclimates needing separate measurement points. So the anchor is a **measurement point**, not a station:

```
Protocol
  └── points[]              ordered; each anchored to a station + microclimate label
        ├── stationId
        ├── microclimate    e.g. "glasshouse_humid" | "shade_dry" | "open_sun"
        └── steps[]         the typed steps above
```

Counterbalancing is then a second protocol file, not a code branch. bio-tour's `paths: { southern, northern }` becomes `protocols: { orderA, orderB }` — and the physical signage for route counterbalancing already exists in the garden.

### Stamps every response row carries

| Field | Why |
|---|---|
| `contentVersion` | Questions get reworded across two semesters. Without it, a semester-2 accuracy shift is uninterpretable — seasonal effect or edited item. Bumped on **any** content change. |
| `protocolId` + `protocolVersion` | Which counterbalance order this participant walked. |
| `deviceEpoch` (at enqueue) **and** `serverTimestamp()` (at write) | The delta is per-device clock drift, needed later to align app timestamps with continuous wearable streams. **bio-tour does not do this** — it stores device epoch + ISO only. Cheap to add now, unrecoverable later. |
| `pointId` + `microclimate` | The within-person paired contrast is the whole design. |

### What bio-tour already gets right, kept as-is

- **Never delete after sync.** `syncStatus` is a column on a durable table, not a queue that drains. Rows outlive the upload, so read-only revisit and audit work. Handoff §4 asks for this; it is already the design.
- **Stale sync claims** are a non-issue by construction: there is no intermediate `"syncing"` state. A row is `local` until a batch commits, so a tab killed mid-upload leaves it `local` and it simply retries — idempotently, because the Firestore doc id *is* the local UUID. Worth keeping exactly as-is rather than "improving".
- **Append-only event log** with discriminated event kinds.
- **Versioned Dexie migrations** with a real `.upgrade()` callback.

---

## 3. Participant codes

`allowed_codes` in the minducate backup is an allowlist, not a state machine — 11 docs shaped `{ _docId: "3599", active: true }`, some with `addedAt`. The mechanism to restore is therefore mostly new. Target:

```
allowed_codes/{code}
  state: "unused" | "active" | "consumed"
  issuedAt, activatedAt?, consumedAt?
  protocolId          which counterbalance order this code was allocated
```

- **Server-side validation only.** A client-side allowlist is readable and enumerable — anyone can page the collection and harvest valid codes. Activation goes through a callable/route using the Admin SDK.
- **Single-use per session** stays — it is right for integrity.
- **Cross-semester linkage** lives in a researcher-held **allocation list** mapping `code → pseudonymous participant ID`. This list is irreplaceable: it is version-controlled, and backed up off the laptop. It never enters the app, the client bundle, or the public repo.

---

## 4. Firestore rules — must change

bio-tour's rules are `allow read: if true` on `participants`, `tour_progress`, `attempts` and `tour_events`. That is defensible for an anonymous open tour with no PII, and it is documented there as a deliberate choice.

It must **not** ship in the research app. With typed codes and a two-semester longitudinal design, an open read lets anyone enumerate every participant's full response history by code. Target: client **write-validated, read-denied**; all reads go through the Admin SDK server-side. Payload-shape validation, document-key/field consistency and the append-only no-delete stance all carry over unchanged — those parts are good.

---

## 5. `offlineQueue.js` — do not carry, and disarm

`flushStore` marks `record.synced = true` whether or not a `firestoreWriter` was passed, and `scheduleSync()` fires `flushAll()` **with no writer** 2 s after every write. Anything logged through it is marked synced without leaving the device, then deleted by `pruneOldSynced()` at 7 days.

Verified state across the repos:

| Repo | Importers | Exposure |
|---|---|---|
| `optemp-minducate` | none — dead code | none; real path is `localDB.enqueue → syncEngine → session_logs`, intact |
| `optemp-garden` | none — dead code | none today |
| `optemp` | `TourContext`, `QRScanner`, `StationFlow`, `useGpsLogger`, `useWakeLock` | **fully wired.** `useTourSync` does pass a real writer, but only on mount / `online` / `visibilitychange` — the 2 s debounce always wins and empties the `by_synced=false` index first. `initOfflineSync()` is never called anywhere, so that second writer-less path is inert; it does not change the outcome. |

**Confirmed with Shakib: `optemp` was lab-testing only. No participant data was lost.**

Actions:
1. `optemp` — apply `if (!firestoreWriter) continue;` so the file is safe if anyone runs it again.
2. `optemp-garden` — delete the dead copy, so the Phase 2A instruction *"all events must be routed through `src/lib/offlineQueue.js`"* cannot be followed into a data loss.
3. `optemp-field` — the file never exists. `lib/sync/push.ts` is the only sync path.

---

## 6. Carried-over open engineering risk

**iOS storage split (unresolved).** Test on a real iPhone whether Safari and the Add-to-Home-Screen instance share an IndexedDB store. If they do not, a participant who starts in Safari and later opens the installed icon gets an empty database and resumption silently fails mid-session, in the field, with no error. `StorageGuard` is where the check belongs. This is a field-blocker, not a polish item.

---

## 7. Blockers outside the code

These do not compress under engineering effort and several gate collection entirely.

| Blocker | Status | Blocks |
|---|---|---|
| **TCV scale** — lab arm used −3→0, field drafts used 0→10 | unresolved | `ThermalRatingStep` cannot be written until decided. **Arms cannot be pooled until unified.** |
| **Ethics amendment** for the field phase | unconfirmed | all collection |
| **TAU infosec** position on Firebase vs Azure | unverified | provider choice (isolated to 2 modules, so it does not block building) |
| **Shared consumer Gmail** holding lab cloud infrastructure | open | fails review regardless of provider; the real governance problem |
| **Garden site survey** — sun angles at session hour, the two benches, walk times, dead zones, battery drain over the full route | not run | protocol timings, dwell durations, the whole point layout |

---

## 8. PR cut-line

1. **PR 0 — scaffold.** `git init`, Next 16 + React 19 + TS + Tailwind v4 + Dexie + Firebase. Exclusion line checked. No remote yet.
2. **PR 1 — data layer.** `dexie.ts`, `push.ts`, `firebase/*`, `env*`, hooks, `StorageGuard`, `SyncStatus`. Clock-drift capture added. Rules tightened per §4.
3. **PR 2 — protocol layer.** Step types, measurement points, `contentVersion`, a synthetic protocol file for testing. No real content yet.
4. **PR 3 — participant codes.** State machine + server-side validation. Allocation list documented, stored outside the repo.
5. **PR 4 — `ThermalRatingStep`.** *Gated on the TCV decision.*
6. **PR 5 — arrival gate, step runner, completion.**
7. **PR 6+ — cognitive tasks from `optemp`.**

Items 1–3 are unblocked today. Item 4 is not.
