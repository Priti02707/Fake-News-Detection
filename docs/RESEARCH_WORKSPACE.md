# Research workspace interface

The requested reference image guides the dark charcoal/navy panels, violet actions, sidebar and two-column news editor/assessment layout. The project's identity remains **Fake News Detection**, with **Priti Kumari** as owner and primary developer. No Fakeddit branding, external biography, source code, model weights or benchmark results were copied.

## Implemented behavior

- The workspace opens directly on the editor, without the previous large introduction. Text, image, video, audio and public-URL tools remain available. UTF-8 text import and drag/drop use the existing validation/limits.
- Assessment mode selects detection, source verification or both. Optional claim/source/evidence/context controls retain their actual API behavior. The right panel has empty, processing, error and real-result states, plus a full-report link. Model confidence is never described as a factual truth probability.
- **Reset** cancels pending analysis/article extraction, clears active input/media/notes and restores default controls; saved reports remain in the browser. Media component cleanup stops its own workers when unmounted.
- **Saved assessments** supports manual save, restore, JSON download, per-report deletion and clear-all. Stored records retain original text, model/verification results, mode/options, context notes, source metadata and an explicitly reader-authored review. Verification-only reports can now be saved. Raw media files are not persisted.
- The existing 30-report history limit and storage key are retained for compatibility. Records are checked before rendering; unusable model/evidence records are ignored. Optional invalid restoration metadata is discarded. Quota/blocked storage failures produce a message rather than a false saved state.
- Reader review options are annotations only; they do not change model scores or automatic factual assessments. Source matching, date context and exact excerpts remain separate from prediction explanations.
- **Methodology**, **API reference**, original model/history/world-news/evidence navigation and developer/profile links work. API readiness is read from actual health; published-review configuration is disclosed. Providers/checkpoints remain honestly unavailable when absent.
- Dark is the default for new sessions; saved light/dark preferences remain usable. Forced-color accessibility mode can select the light palette. Mobile panels stack with an accessible navigation toggle. Focus states, reduced motion and print styles are included.

## Implementation and boundaries

`frontend/research-workspace.tsx` owns the assessment overview and saved-report controls. `frontend/news-types.ts` shares UI/report types; `frontend/saved-assessments.ts` checks stored records. `frontend/research.css` styles the new workspace and existing feature pages. Existing FastAPI contracts and trained weights are unchanged. No database, authentication, forensic classifier or automatic LLM truth-verdict service is added by this interface release.

This implements the specifically requested workspace, not every planned page/research phase in the master prompt. There are no fabricated analytics, published ratings, quotes or result examples. Screenshots use actual app rendering; any practice article is labeled illustrative.

## Validation

Node logic checks passed **13 tests**, including legacy history, source-only records and corrupt-browser-record handling. The first full local production-build browser run passed **48 desktop/mobile checks**, with **16 opt-in model/media integrations skipped**. The final focused rerun passed **16 desktop/mobile cases**, including cancellation of an in-flight URL extraction on Reset and the complete source-only saved-report lifecycle. Python regressions passed **97 tests**, with **1 optional checkpoint case skipped**. Production build, typecheck and diff checks passed. Actual screenshots were refreshed from the final local production build and visually inspected. CI and publication results are recorded in the corresponding GitHub pull request. No new model accuracy is claimed.

Release resumption on 2026-11-02 re-ran `npm run build`, `npm run typecheck`, `git diff --check`, `.venv/bin/python -m pytest tests -q` (**97 passed, 1 skipped**), `npm run test:unit` (**13 passed**) and `npm run test:e2e -- --workers=1` against the local development server and actual FastAPI backend (**50 passed, 16 opt-in integrations skipped**). The complete browser suite now includes extraction cancellation on Reset on both desktop and mobile. The existing GitHub repository and linked `priti-09/verity-news` project are the publication targets.
