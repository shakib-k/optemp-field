# OPTemp Field

Offline-first PWA for the **field arm** of the OPTemp research programme — how thermal state alters value-based decision-making.

Participants walk a counterbalanced route through the TAU Botanical Garden's microclimates (humid glasshouse, dry shade, open sun). At each measurement point the app collects subjective thermal ratings (TSV/TCV), behavioural task data, and — later — wearable physiology, entirely offline, syncing when a connection returns.

M.Sc. research, Sagol School of Neuroscience, Tel Aviv University. PI: Prof. Tom Schonberg.

## Status

**PR 0 — scaffold.** Configuration only. No data layer, no protocol, no UI yet.
See `docs/OPTEMP_FIELD_PORT_PLAN.md` for the full plan and the PR cut-line.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (`strict` + `noUncheckedIndexedAccess`) · Tailwind v4 · Dexie (IndexedDB) · Firebase

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Firebase config
npm run dev
```

`npm run typecheck` must pass before any commit.

## Design commitments

These are decided, not open. Full rationale in the port plan.

- **Local-first.** Dexie is the source of truth on the device; the sync layer pushes to Firestore in the background. Every read comes from Dexie, so the app works with no signal.
- **Never delete after sync.** Sync state is a column on a durable table, not a queue that drains. Rows outlive their upload so revisit and audit remain possible.
- **Idempotent sync.** The locally generated UUID *is* the Firestore document id, so a retry after a mid-upload kill overwrites rather than duplicates.
- **Clock-drift capture.** Every row stores the device clock at enqueue *and* a server timestamp at write. The delta is what later aligns app events with continuous sensor streams — unrecoverable if not captured at collection time.
- **`contentVersion` on every response row.** The study runs across two semesters; without a version stamp an accuracy shift is uninterpretable (seasonal effect, or an edited item?).
- **Protocol-as-data.** The experiment lives in a content file as an ordered list of typed steps anchored to measurement points. Counterbalancing is a second protocol file, never a code branch.
- **Server-side code validation.** A client-readable allowlist is enumerable. Participant-code activation goes through the Admin SDK.

## Provenance

Infrastructure patterns in this repo (the Dexie schema shape, the batched idempotent sync worker, the storage and sync-status guards) were written by the author for an earlier project and re-implemented here. **No third-party or faculty-owned content is included in this repository** — no station text, quiz items, photography, or map assets from any other study.

## Repository layout

```
src/
  app/              Next App Router routes
  components/       UI
  hooks/            useWakeLock, useOnlineStatus, useSyncState
  lib/
    db/             Dexie schema + session state
    sync/           push worker (the only sync path in this repo)
    firebase/       client + admin — the provider boundary
    protocol/       typed step + measurement-point schema
  types/
docs/               port plan, protocol spec
scripts/            backup, CSV export, wipe
```

## Not in this repository, by design

- The **participant allocation list** (code → pseudonymous participant ID). It is the only thing linking a participant's sessions across semesters, it is irreplaceable, and it is version-controlled and backed up separately — never in the app, the client bundle, or here.
- Any raw participant data. `firestore-backups/` and `firestore-exports/` are gitignored.
