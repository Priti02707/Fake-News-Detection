# Verity frontend

This folder contains the existing website's React/TypeScript interface, styles and browser workers.

| File | Purpose |
|---|---|
| `page.tsx` | Main interface, navigation, article analysis and history |
| `globals.css` | Styling, responsive layouts and print presentation |
| `media-input.tsx` | Image/video uploads, local extraction and review |
| `image-context.tsx` | Image–caption comparison and investigation |
| `video-timeline.tsx` | Timestamped media observations and evidence links |
| `investigation.tsx` | Evidence retrieval, citations, reader findings and exports |
| `*.worker.ts` | Browser-local OCR, speech and optional model processing |

Run from the **repository root**:

```sh
npm run dev
```

Open http://localhost:3000. Start FastAPI separately as described in the root README for analysis/evidence requests.

`app/page.tsx` is the Next.js route entry and `app/layout.tsx` supplies the framework layout. Dependencies, `next.config.ts`, TypeScript/PostCSS configuration and deployment files stay at the root. The existing npm, Docker and Vercel workflows use this frontend; there is no duplicate application to maintain.
