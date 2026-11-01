# Security and data handling

- Legacy POST bodies remain bounded to 100 KB; v2 reviewed-media metadata has a 500 KB body cap. Pydantic limits strings, segments and frames.
- Uploaded images/videos are decoded locally and never uploaded by the media workflow. Browser file-type allowlists are supplemented by real decoding; dimensions, sizes, duration, samples and timeouts are bounded.
- Public-source retrieval rejects non-web protocols, credentials, nonstandard ports and any non-public DNS answer. Redirects are revalidated, connections are pinned to checked addresses, and HTTPS certificates are verified. Pages and redirects are bounded. Paywalls are not bypassed.
- API responses use no-store/nosniff headers and correlation IDs. Structured logs contain method/path/status/timing, never article bodies, pasted quotes, API keys or full source URLs.
- A bounded per-process request guard limits POST abuse. This is not a distributed rate-limit guarantee on serverless infrastructure; provider/ingress limits remain necessary for high traffic.
- Comparison workers are lazy and cancellable. There are no automatic heavy model downloads during API startup. Research caches/checkpoints are ignored by Git, Docker context and Vercel packaging.
- Google keys are server-side only. Third-party searches receive queries only when requested. Recognition downloads expose ordinary connection metadata to delivery hosts, not the uploaded file.
- C2PA inspection disables remote manifest fetching and does not establish signer trust. Manifest strings are displayed as React text, never injected HTML.
- Citation authenticity and model provenance remain explicit. Reader-provided evidence and client media observations are not authenticated simply because the API accepts a valid schema.
- Production model changes require measured comparison and manual review. No public model-promotion endpoint is exposed.

These controls and tests are not a complete independent security audit. No distributed durable job queue or shared evidence database is provisioned by this release.

## Local research checkpoint boundary

The separate research service accepts text only, with a server-configured checkpoint directory. Requests cannot select file paths or model identifiers. Loading is lazy and offline, uses safetensors with remote code disabled, verifies model/tokenizer file hashes against the operator-trusted manifest, and bounds inference to one slot per process. Corrupt/missing artifacts return generic errors without local paths or article text. Manifest checks do not authenticate an untrusted manifest. The service has existing request/body limits and correlation headers but no account authentication; run on localhost with one worker. It is not imported by the production Vercel entry point.
