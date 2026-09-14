# Decision log

Append-only. Each entry: what was decided, when, and what would have to change for it to be revisited.

---

## 2026-09-14 — New repository, not a fork of any existing app

**Decided.** `optemp-field` is a new repository with fresh git history, no GitHub fork relationship to any other repo.

**Why.** This repository is intended to be readable by other researchers. It must not carry, in its history or its GitHub metadata, a relationship to `bio-tour` — an app built for the TAU Faculty of Biology for a different purpose and a different audience.

**Consequence.** Infrastructure the author wrote previously is re-implemented here by copy-and-adapt, file by file, with an explicit exclusion line for third-party content (port plan §0).

---

## 2026-09-14 — TypeScript

**Decided.** TypeScript with `strict` and `noUncheckedIndexedAccess`.

**Why.** The study runs across two semesters with a versioned content schema. Schema drift between semesters is the failure mode that silently corrupts analysis; the compiler is the cheapest place to catch it.

---

## 2026-09-14 — `offlineQueue.js` will never exist in this repository

**Decided.** `src/lib/sync/push.ts` is the only sync path. The `offlineQueue.js` pattern used in `optemp` / `optemp-minducate` / `optemp-garden` is not carried over.

**Why.** In that implementation `flushStore` marks a record synced whether or not a Firestore writer was supplied, and the debounced `flushAll()` call passes none — so records were marked synced without leaving the device, then pruned after seven days. Verified lab-testing only; no participant data was lost. But an existing strategy document instructs routing *all* events through that file, so the file itself is the hazard.

**Revisit if.** Never. If an offline queue is needed beyond what Dexie provides, it gets written fresh with a test that asserts a record is not marked synced without a successful remote write.

---

## 2026-09-14 — Firestore reads are server-side only

**Decided.** Client may write (shape-validated, append-only, no deletes). Client may not read participant collections. Reads go through the Admin SDK.

**Why.** With typed participant codes and longitudinal data, an open read lets anyone holding a code enumerate that participant's full response history. An earlier open-tour design used `allow read: if true`, which was defensible there (anonymous, no PII, no typed codes) and is not defensible here.

---

## OPEN — TCV scale is unresolved

**Blocks.** `ThermalRatingStep`, and therefore PR 4.

The lab arm used −3→0; field drafts used 0→10. **Arms cannot be pooled until this is unified.** Decide before any collection, not after.
