# Fake News Detection — project orchestration

Owner/primary developer: **Priti Kumari** · [GitHub](https://github.com/Priti02707). Updated 2026-11-02.

## Current release

Phase 0: source review, architecture/planning and renamed-application acceptance verified; final repository release is gated by PR #2 checks. Requested display name: **Fake News Detection**. The existing GitHub repository and Vercel deployment are retained. [PLAN.md](PLAN.md), [PHASES.md](PHASES.md), [ROADMAP.md](ROADMAP.md), [architecture](docs/ARCHITECTURE.md), [reference comparison](docs/REFERENCE_COMPARISON.md), [API contract](docs/API_CONTRACT.md) and [evaluation](docs/MODEL_EVALUATION.md) are the current planning record. Historical implementation reports use a different phase numbering; their past completion totals do not apply to this master prompt.

## Decisions and dependencies

| Decision | Reason/dependency |
| --- | --- |
| Keep current repo, Next.js, FastAPI and Vercel project | Working tested foundation; avoid reinitialization or a parallel app |
| Rename displayed product and attribute Priti Kumari | Explicit user instruction; preserve real commit authorship |
| No upstream code copied | Neither reviewed reference tree included a license file |
| Retain portable production models | New models require independent validation, not interface changes |
| Browser media remains local and bounded | No durable worker/object store is provisioned |
| Account/history and grounded agent are later phases | Require persistent infrastructure, secrets and acceptance tests |

## Current blockers

- Published fact-check API key absent in the last production health check.
- GDELT returned unavailable in the last live world-news request.
- No reviewed independent multilingual, media-forensic or paired-fusion evaluation release.
- Existing article dataset's original redistribution rights are unconfirmed.
- No configured authentication, production history database, long-video job broker or LLM evidence service.
- Repository owner has not selected a software license.

These block their dependent capabilities, not Phase 0 planning or the rename. Do not claim later phases are complete.

## Release checklist

- Reference source trees/revisions verified; comparison written before branding implementation.
- Planning and architecture documents created; existing useful structure preserved.
- UI/API/package metadata renamed; About/footer identify Priti Kumari and link her profile.
- Verification results, Git checkpoint, publication and unresolved issues recorded in [Phase 0 report](docs/PHASE_0_REPORT.md).

Next: Phase 1 foundation acceptance audit, then Phase 2 design system. Open later phases one at a time using their acceptance gates. No datasets/checkpoints are downloaded automatically and no external metrics are relabeled as new experiments.

## Subsequent explicit user request: combined assessment

The user requested the screenshot-style detect/verify selector after Phase 0. This bounded feature adds detection, source-only and combined modes, source/context notes, independent evidence reports and browser recovery; see [implementation and checks](docs/DETECT_VERIFY.md). It does not certify the full design-system, grounded-LLM or later research phases. Provider configuration remains a dependency.

## Subsequent explicit user request: research-workspace interface

Implemented the user-supplied dark/violet editor-and-assessment layout with preserved Fake News Detection identity. Manual saved assessments now include verification-only reports, original input, mode, notes, source metadata and reader reviews; reset, restoration, download, deletion and clear actions are connected. Existing routes, models and browser-local media remain available. This is a bounded interface/history release, not certification of all remaining master-prompt phases. See [workspace behavior and verification](docs/RESEARCH_WORKSPACE.md).
