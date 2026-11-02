> Canonical supplied requirements, with the user-requested project name substituted. The existing repository is already created and connected. Follow the Phase 0 starting task and sequential phase gates; this document describes requirements, not implemented features.

# Fake News Detection — COMPLETE MASTER DEVELOPMENT PROMPT

## 1. ROLE AND RESPONSIBILITIES

Act as an expert team consisting of:

- Senior Full-Stack Software Architect
- AI/ML Research Engineer
- Multimodal Deep Learning Specialist
- Natural Language Processing Engineer
- Computer Vision Engineer
- Retrieval-Augmented Generation (RAG) Engineer
- MLOps and DevOps Engineer
- UI/UX Designer
- Cybersecurity Engineer
- Technical Documentation Specialist

Your responsibility is to design and develop a complete, production-oriented, portfolio-ready multimodal fake news detection and fact-checking platform.

Build the project in well-defined, testable phases, following professional software engineering, responsible AI, security, and reproducible ML practices.

Do not produce a basic demonstration that merely returns randomly generated fake/real predictions.

---

# 2. PROJECT INFORMATION

**Project Name:** Fake News Detection

**Full Title:** Fake News Detection — Intelligent Multimodal Fake News Detection & Evidence-Based Fact-Checking Platform

**Official Project Owner and Primary Developer:** Priti Kumari

**GitHub Username:** Priti02707

**GitHub Profile:** [https://github.com/Priti02707](https://github.com/Priti02707)

**Proposed Repository Name:** Fake-News-Detection

**Proposed Repository URL:** [https://github.com/Priti02707/Fake-News-Detection](https://github.com/Priti02707/Fake-News-Detection)

The proposed repository URL must be verified after repository creation.

**Development Environment:**

- macOS with Apple Silicon M2
- Visual Studio Code
- Git and GitHub
- Python
- Node.js
- Docker
- AI coding assistant: Codex

The application should support development on Apple Silicon while remaining deployable on Linux-based hosting infrastructure.

---

# 3. PROJECT OWNERSHIP AND ATTRIBUTION

Priti Kumari is the sole designated project owner and primary developer.

## Ownership rules

1. The official repository should belong to GitHub account Priti02707.
2. Display Priti Kumari as the project owner in README.md.
3. Display her name and GitHub profile on the application's About/Developer page.
4. Include her GitHub profile in the website footer.
5. Use accurate project-author metadata.
6. Do not designate another individual as an owner or primary developer.
7. Preserve authentic Git commit authorship.
8. Credit genuine external contributions.
9. Follow third-party licenses and attribution requirements.
10. Do not present external code, models, datasets, or research as original work by Priti Kumari.

GitHub repository ownership, project leadership, software authorship, and legal copyright ownership are different concepts. Do not conflate them.

## AI-assisted development

AI tools may assist with:

- Code generation
- Architecture planning
- Debugging
- Testing
- Documentation
- Design improvements

Do not falsify contribution history or claim that unimplemented AI-generated code was tested.

Comply with applicable academic policies on AI-assisted work.

---

# 4. REFERENCE REPOSITORIES

Analyze the following projects before implementation.

### Reference 1

[https://github.com/VishalDhariwal/Fake-news-prediction-app](https://github.com/VishalDhariwal/Fake-news-prediction-app)

Study its actual frontend architecture, React components, visual design, routing, user interaction, libraries, and reusable patterns.

Its repository uses React, TypeScript, Vite, Tailwind CSS, and shadcn/ui-related dependencies.

Do not assume that it contains a fully functional or scientifically evaluated fake news model without verifying its source code.

### Reference 2

[https://github.com/Priyanshuraj0909/Fakeddit-Multimodal-FakeNews](https://github.com/Priyanshuraj0909/Fakeddit-Multimodal-FakeNews)

Study its:

- Text classification pipeline
- Dataset preparation
- Evaluation methodology
- Model serving architecture
- FastAPI endpoints
- Evidence verification implementation
- OCR functionality
- Experimental multimodal work
- Tests and MLOps practices

Its documentation distinguishes implemented features from experimental and planned capabilities. Maintain that distinction.

### Reference integration rules

- Do not blindly clone and rename an existing project.
- Review licenses before copying code.
- Preserve required notices.
- Document reused components.
- Develop an original cohesive application.
- Use reference projects for inspiration and technically justified reuse.
- Never copy benchmark results and present them as new experiments.

Create a reference comparison report before development.

---

# 5. PROJECT VISION

Develop an intelligent web platform that helps users investigate potentially misleading news from:

1. Text headlines
2. Full-length news articles
3. Images
4. Screenshots
5. Uploaded videos
6. News URLs
7. Supported social-media URLs
8. Combined text, image, and video submissions

The application must use AI and external evidence to analyze factual claims, media context, and source reliability.

It should help users understand why a news claim may be supported, contradicted, misleading, or unverifiable.

The application must not claim that an AI classifier alone can determine objective factual truth.

---

# 6. CORE FEATURES

## FEATURE 1 — AI Text Fake News Detection

Implement a complete NLP pipeline.

Capabilities:

- Text input and paste support
- Article upload where supported
- Text cleaning and preprocessing
- Language identification
- English and Hindi support
- Named entity recognition
- Important claim extraction
- TF-IDF + Logistic Regression baseline
- Transformer-based text classification
- Sensationalism detection
- Potentially misleading language analysis
- Confidence calibration
- Explainable text predictions
- Uncertainty and abstention handling

Investigate models such as:

- RoBERTa
- DeBERTa
- Multilingual BERT
- XLM-RoBERTa

Select models based on measured performance, computational cost, language coverage, and dataset suitability.

Do not promise a specific model accuracy before evaluation.

## FEATURE 2 — AI Image Analysis

Allow users to upload JPG, PNG, and WEBP images.

Implement:

- Image validation
- OCR text extraction
- Caption extraction where feasible
- Image/text relevance assessment
- CLIP-based image-text embeddings
- Detection of contextual inconsistencies
- Image metadata inspection
- Image reuse investigation
- Optional reverse-image search integration
- C2PA Content Credentials verification
- Optional manipulation or synthetic-image detection

Distinguish:

- AI-generated imagery
- Manipulated imagery
- Authentic imagery used in misleading context
- Unverifiable imagery

Do not label an image fake merely because metadata is absent.

Use a trained, independently evaluated image classifier before displaying manipulation probabilities.

## FEATURE 3 — AI Video Fake News Detection

Allow supported video uploads.

Implement:

- MP4/WebM upload
- File validation and size limits
- FFmpeg media processing
- Video metadata extraction
- Speech-to-text transcription
- Timestamped transcript display
- Video-frame extraction
- OCR from representative frames
- Visual/text semantic comparison
- Speech-based factual claim extraction
- Frame-level contextual analysis
- Evidence retrieval for spoken claims

Optional advanced capabilities:

- Face manipulation detection
- Audio/video inconsistency analysis
- Synthetic speech detection
- Experimental temporal deepfake detection

Deepfake detection must be presented as experimental unless independently evaluated.

For every finding, provide timestamps and supporting observations when available.

## FEATURE 4 — News URL Verification

Users should be able to paste public news URLs.

Implement:

- Secure URL validation
- Article text extraction
- Headline extraction
- Publication date extraction when available
- Author and publisher metadata
- Article image extraction where permitted
- Claim extraction
- Evidence retrieval
- Source comparison

Do not bypass authentication, paywalls, access restrictions, or website terms.

Prevent server-side request forgery (SSRF), including private-network redirects and DNS rebinding risks.

## FEATURE 5 — AI Fact-Checking Agent

Build a Retrieval-Augmented Generation fact-checking service.

Processing pipeline:

1. Receive news content.
2. Identify factual statements.
3. Split complex statements into atomic claims.
4. Extract entities, dates, places, and relevant context.
5. Search for existing fact checks.
6. Retrieve relevant trustworthy evidence.
7. Compare supporting and contradicting sources.
8. Assess publication dates and source independence.
9. Identify missing evidence.
10. Generate a structured verification report.

Possible integrations:

- Google Fact Check Tools API
- Configurable web search API
- Public fact-checking sources
- Groq-hosted LLMs
- Other properly configured LLM providers

Use an evidence-first architecture.

Never fabricate:

- News sources
- URLs
- Article titles
- Dates
- Quotations
- Evidence excerpts
- Verification results

If external verification is unavailable, return an explicit failure or unavailable status.

## FEATURE 6 — Multimodal AI Fusion

Explore combining:

- Text embeddings
- Image embeddings
- Video-frame embeddings
- Speech transcript embeddings
- Evidence features
- Relevant contextual metadata

Experiment with:

- Late fusion
- Feature concatenation
- Learned fusion classifiers
- Attention-based fusion where justified

Train fusion models using appropriately labeled and aligned multimodal datasets.

Conduct modality ablation experiments.

Do not combine unrelated classifier scores into a single truth probability without independent validation.

If a model checkpoint is missing, report that the capability is unavailable.

## FEATURE 7 — Explainable AI

Users must be able to inspect why a result was produced.

Provide:

- Important text features
- Evidence excerpts
- Claim-level reasoning summaries
- Source comparison
- Image-context explanations
- Video timestamps
- Model limitations
- Confidence and uncertainty indicators

Keep model-feature explanations separate from real-world factual evidence.

Explainability must represent actual implemented behavior, not fictional AI reasoning.

## FEATURE 8 — Multilingual Support

Initially prioritize:

- English
- Hindi

Design for future extensions to additional languages.

Implement:

- Language detection
- Multilingual claim extraction
- Multilingual text analysis
- Translation when necessary
- Source-language preservation
- Consistent multilingual UI labels

Evaluate multilingual model performance separately.

## FEATURE 9 — Verification History

Provide authenticated users with:

- Previous analyses
- Saved reports
- Input type
- Analysis date
- Status
- Evidence summary
- Search and filtering
- Report deletion
- PDF/JSON export

Implement sensible retention and privacy controls.

## FEATURE 10 — Dashboard and Analytics

Create an interactive dashboard showing real analysis data.

Possible visualizations:

- Number of analyzed submissions
- Input modality distribution
- Verification verdict distribution
- Completed and failed analyses
- Common unsupported claim categories
- Source comparison summaries
- Recent verification history

Do not fabricate dashboard statistics.

Use empty states when no records exist.

---

# 7. FACT-CHECKING VERDICT SYSTEM

Use evidence-based categories:

- **Supported:** Relevant evidence supports the claim.
- **Contradicted:** Strong relevant evidence contradicts the claim.
- **Misleading Context:** Some content may be accurate, but its presentation changes its meaning.
- **Mixed Evidence:** Available evidence is materially conflicting.
- **Unverified:** The claim has not been verified.
- **Insufficient Evidence:** Available sources cannot justify a conclusion.

Separate verdicts from model predictions.

For example, a text classifier may identify misinformation-like language while independent evidence supports the factual claim.

The system must communicate such disagreement transparently.

Do not display a universal "98% fake" score unless the value has a rigorously established statistical interpretation.

---

# 8. PROFESSIONAL FRONTEND DESIGN

Create a premium, modern SaaS-style interface.

Design inspiration:

- Modern AI research dashboards
- Professional cybersecurity platforms
- News intelligence applications
- Clean analytics software

Visual style:

- Dark navy and charcoal backgrounds
- Cyan and violet accent colors
- Subtle gradients
- Modern typography
- Smooth microinteractions
- Responsive cards
- Accessible navigation
- Professional loading states
- Consistent spacing and hierarchy

Use:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Recharts

Create these pages:

1. Landing Page
2. Dashboard
3. Text Analyzer
4. Image Analyzer
5. Video Analyzer
6. URL Analyzer
7. Verification Report
8. Evidence Comparison
9. Analysis History
10. About / Developer
11. Model Information
12. Settings

### Developer page requirements

Display:

**Priti Kumari**

Project Owner & Developer

GitHub: [https://github.com/Priti02707](https://github.com/Priti02707)

Provide a clickable GitHub profile link.

Do not add invented qualifications, achievements, experience, photographs, or biographical details.

### UI reliability requirements

Every visible feature must have a corresponding backend implementation or a clearly marked unavailable state.

Never populate production results using fake static AI responses.

---

# 9. BACKEND ARCHITECTURE

Use FastAPI and Python.

Implement modular services for:

- Authentication
- File upload
- Text classification
- Image analysis
- Video analysis
- Claim extraction
- Evidence retrieval
- Fact verification
- Reporting
- Analysis history
- Model capability reporting

Suggested endpoints:

POST /api/v1/analyze/text

POST /api/v1/analyze/image

POST /api/v1/analyze/video

POST /api/v1/analyze/url

POST /api/v1/verify/claims

GET /api/v1/analyses/{analysis_id}

GET /api/v1/analyses/{analysis_id}/report

GET /api/v1/capabilities

GET /health

Use Pydantic models to enforce request and response contracts.

For long-running video tasks, use background job processing with persistent status tracking. Do not rely on ordinary HTTP requests staying open indefinitely.

Return appropriate error codes and meaningful error descriptions.

---

# 10. RECOMMENDED TECHNOLOGY STACK

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- Recharts

Backend:

- Python 3.12
- FastAPI
- Uvicorn
- Pydantic
- SQLAlchemy

Machine Learning:

- scikit-learn
- PyTorch
- Transformers
- Sentence Transformers
- CLIP
- OpenCV
- Pillow

Media Processing:

- FFmpeg
- Whisper
- OCR engine

AI and RAG:

- LangChain or lightweight custom orchestration
- ChromaDB or FAISS
- Configurable LLM provider
- Configurable retrieval provider

Database:

- PostgreSQL
- SQLite for early local development where appropriate

MLOps:

- MLflow
- pytest
- Ruff
- GitHub Actions
- Docker

Select only necessary libraries. Avoid installing heavyweight components before they are used.

---

# 11. SYSTEM ARCHITECTURE

The architecture should follow this logical flow:

User Input
↓
React Frontend
↓
FastAPI Backend
↓
Input Validation and Processing
↓
Modality-Specific Analysis
├── Text NLP
├── Image Intelligence
├── Video Intelligence
└── URL Extraction
↓
Claim Extraction
↓
Evidence Retrieval
↓
Fact Verification
↓
Structured Results
↓
User Dashboard and Exportable Report

Keep ML inference, external retrieval, and factual verdict generation as logically separate services.

Design clear interfaces between modules.

---

# 12. DATASETS AND MODEL TRAINING

Research appropriate datasets, including:

- Fakeddit
- LIAR
- FakeNewsNet
- Suitable image manipulation datasets
- Suitable video manipulation datasets

Before downloading, document:

- Dataset source
- License and access requirements
- Label definitions
- Modalities
- Language
- Dataset size
- Potential class imbalance
- Known limitations
- Intended evaluation task

Use reproducible splits.

Prevent train/test contamination through:

- Duplicate content
- Shared images
- Repeated news stories
- Near-identical headlines
- Shared source leakage where relevant

Do not interpret dataset classification accuracy as universal real-world fact-checking accuracy.

Track the distinction between misinformation labels, manipulated-media labels, and verifiable factual claims.

---

# 13. MODEL EVALUATION

Evaluate models using:

- Accuracy
- Precision
- Recall
- Macro F1
- Confusion matrix
- AUROC where applicable
- Calibration metrics
- Coverage under abstention
- Inference latency
- Memory consumption

For the fact-checking service evaluate:

- Claim extraction correctness
- Evidence relevance
- Citation correctness
- Verdict correctness
- Source freshness
- Failure handling

For multimodal experiments evaluate:

- Text-only baseline
- Image-only baseline
- Text + image
- Text + video
- Combined multimodal configuration where supported

All results must be generated from executed experiments.

Never create artificial metrics for README badges or project presentations.

---

# 14. SECURITY, PRIVACY, AND RESPONSIBLE AI

Implement:

- Upload-size limitations
- MIME validation
- File signature checks
- Safe temporary file handling
- Secure media processing
- Rate limiting
- Authentication and authorization
- SSRF protection
- Secrets management
- Structured error handling
- API timeout limits
- Data retention controls
- User-accessible history deletion
- Dependency vulnerability checks

Treat external retrieved content as untrusted data.

Prevent prompt injection attempts from news webpages, uploaded documents, transcripts, and search results.

Do not allow retrieved content to override system instructions or fabricate evidence.

Protect against:

- Biased model outputs
- Overconfident verdicts
- Unsupported citations
- Misleading percentages
- Defamation through unverified claims
- False allegations of manipulated media

The platform is a decision-support system, not an infallible authority on truth.

---

# 15. PROJECT DIRECTORY STRUCTURE

Use the following structure as an initial proposal, refining it after the architecture review.

```text
fake-news-detection/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── styles/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── text/
│   │   │   ├── image/
│   │   │   ├── video/
│   │   │   ├── retrieval/
│   │   │   └── verification/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
│
├── ml/
│   ├── data/
│   ├── notebooks/
│   ├── preprocessing/
│   ├── training/
│   ├── evaluation/
│   ├── experiments/
│   └── artifacts/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATASETS.md
│   ├── MODEL_EVALUATION.md
│   ├── API_CONTRACT.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
│
├── .github/
│   └── workflows/
│
├── AGENTS.md
├── MASTER_ORCHESTRATOR.md
├── PLAN.md
├── PHASES.md
├── ROADMAP.md
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
└── LICENSE
```

Do not automatically choose an open-source license without confirmation from the repository owner.

Keep datasets, secrets, uploaded media, and large model checkpoints out of Git unless explicitly appropriate and legally permitted.

---

# 16. REQUIRED PROJECT PLANNING DOCUMENTS

Before starting substantial implementation, create:

### AGENTS.md

Define coding conventions, architectural rules, quality standards, allowed dependencies, testing expectations, and instructions for AI coding agents.

### MASTER_ORCHESTRATOR.md

Track all phases, project decisions, completed deliverables, dependencies, blockers, and next actions.

### PLAN.md

Describe the full implementation strategy, system architecture, technical requirements, and milestone deliverables.

### PHASES.md

Document each phase separately with tasks, expected outputs, verification steps, and Git checkpoints.

### ROADMAP.md

Show short-term MVP goals and longer-term research features.

### ARCHITECTURE.md

Include system diagrams, component boundaries, data flow, APIs, and model lifecycle.

### DATASETS.md

Record data provenance, licensing, preprocessing, and evaluation splits.

### MODEL_EVALUATION.md

Track actual benchmark results and experimental configurations.

### API_CONTRACT.md

Document endpoints, authentication, input/output schemas, and errors.

### SECURITY.md

Document threat models, upload handling, external URL safety, and data protection.

### README.md

Create professional GitHub documentation with:

- Project introduction
- Feature list with implementation status
- Technology stack
- Architecture diagram
- Setup instructions
- Screenshots from the actual application
- Dataset references
- Evaluated model results
- API documentation
- Deployment instructions
- Project limitations
- License information
- Developer credit

The README must identify Priti Kumari as project owner and primary developer while preserving legally required external attribution.

---

# 17. COMPLETE DEVELOPMENT PHASES

## Phase 0 — Research and Architecture

Analyze reference repositories.

Produce:

- Codebase comparison
- Feature inventory
- Reuse feasibility report
- Architecture decisions
- Security considerations
- ML evaluation strategy
- Development roadmap

No large-scale implementation yet.

## Phase 1 — Project Foundation

Set up:

- Local development environment
- Git repository
- Python virtual environment
- React application
- FastAPI application
- Formatting and linting
- Environment configuration
- Initial tests
- Basic CI

Verify the project runs on Mac M2.

## Phase 2 — Frontend Design System

Implement:

- Navigation
- Landing page
- Dashboard layout
- Upload components
- Analyzer interfaces
- Loading/error states
- Responsive design
- About page

Connect real backend health and capability endpoints.

## Phase 3 — Backend Foundation

Implement:

- FastAPI modules
- Database models
- Authentication
- Upload handling
- Analysis records
- API validation
- Health endpoint
- Security middleware

Write backend tests.

## Phase 4 — Text Classification

Implement:

- Text preprocessing
- Dataset preparation
- Baseline model
- Transformer experiment
- Evaluation pipeline
- Versioned model serving
- Text explanation
- API integration

Only publish measured results.

## Phase 5 — AI Fact-Checking

Implement:

- Claim extraction
- External evidence retrieval
- Evidence ranking
- Structured citations
- Verification verdicts
- Retrieval failure handling
- Fact-check report generation

Evaluate claims and evidence separately from model classification.

## Phase 6 — Image Intelligence

Implement:

- Image upload
- OCR
- Metadata extraction
- CLIP comparison
- Image-context investigation
- Provenance verification
- Optional evaluated manipulation classifier

Provide clear capability status.

## Phase 7 — Video Intelligence

Implement:

- Video upload
- Media validation
- FFmpeg processing
- Speech transcription
- Frame extraction
- Frame OCR
- Timestamped claim analysis
- Evidence-based video reports

Optimize processing for local development.

## Phase 8 — Multimodal Fusion

Implement:

- Embedding extraction
- Feature alignment
- Fusion model experiments
- Modality ablations
- Held-out evaluation
- Model artifact versioning

Do not deploy experimental fusion as a validated classifier until tests support it.

## Phase 9 — Reports and User History

Implement:

- Structured verification reports
- Claim-level citations
- PDF and JSON exports
- Saved history
- Analysis filtering
- Status tracking
- Privacy-aware deletion

## Phase 10 — Testing and MLOps

Implement:

- Unit tests
- Integration tests
- Frontend tests
- Model regression tests
- Security tests
- MLflow tracking
- CI pipelines
- Docker packaging
- Deployment checks

Document known limitations.

## Phase 11 — Deployment and Portfolio Readiness

Implement:

- Production configuration
- Frontend deployment
- Backend deployment
- Environment variable management
- API connectivity testing
- Real application screenshots
- Comprehensive README
- Demonstration scenarios
- Developer portfolio presentation

Do not claim the project is deployed until the live application has been verified.

---

# 18. PHASE COMPLETION POLICY

For every phase provide:

1. Phase objective
2. Files created
3. Files modified
4. Dependencies installed
5. Algorithms implemented
6. Terminal commands
7. Tests executed
8. Actual test results
9. Unresolved problems
10. Git commit recommendation
11. Next phase prerequisites

Never mark a task complete merely because code has been generated.

A phase is complete only after its acceptance criteria have been verified.

If the environment cannot run a required test, document that limitation.

---

# 19. GITHUB DEVELOPMENT WORKFLOW

The main repository should be created under:

[https://github.com/Priti02707](https://github.com/Priti02707)

Recommended repository name:

Fake-News-Detection

Use a professional workflow:

- Keep the main branch stable.
- Develop new features on feature branches.
- Use meaningful commit messages.
- Submit pull requests for major features.
- Run CI before merging.
- Preserve authentic contribution metadata.
- Never expose API keys.
- Avoid committing training datasets or huge binaries.
- Tag tested releases.

Example commit conventions:

- feat: implement text classification API
- feat: add image OCR pipeline
- feat: implement video transcription
- feat: integrate evidence retrieval
- test: add claim verification tests
- docs: update architecture
- fix: correct upload validation

Do not force-push over unrelated work.

Do not rewrite Git history to change apparent authorship.

---

# 20. PERFORMANCE REQUIREMENTS

Optimize for:

- Reliable inference
- Stable backend response times
- Asynchronous media processing
- Efficient memory usage
- Reasonable local development resources
- Responsive frontend interaction
- Reproducible experiments
- Clear API failures

Use lightweight models for the first working MVP.

Make advanced GPU-intensive experiments optional.

Prefer working functionality over unnecessary architectural complexity.

---

# 21. PROJECT SUCCESS CRITERIA

The completed application should allow users to:

1. Submit a news headline and receive a tested classifier prediction.
2. Extract checkable claims from articles.
3. Retrieve evidence and produce cited factual assessments.
4. Upload an image and inspect text, context, and available provenance signals.
5. Upload a video and receive a timestamped transcript and claim-level analysis.
6. Analyze accessible public news URLs.
7. View model limitations and uncertainty.
8. Compare supporting and contradicting sources.
9. Review saved verification results.
10. Export a structured verification report.

Every capability must be honestly marked as:

- Implemented
- Experimental
- Planned
- Unavailable

Do not misrepresent a user interface preview as a working AI model.

---

# 22. FINAL DEVELOPMENT INSTRUCTIONS

Work as a disciplined engineering agent.

Before coding:

- Inspect the repository.
- Check the current environment.
- Read relevant documentation.
- Identify existing reusable components.
- Establish a minimal working architecture.
- Choose the next achievable phase.

While coding:

- Write modular, readable code.
- Add tests.
- Handle errors properly.
- Keep dependencies justified.
- Maintain documentation.
- Avoid unnecessary rewrites.
- Verify implementation against acceptance criteria.

After coding:

- Run appropriate tests.
- Report the actual outcome.
- Update project documentation.
- Explain how to launch the application.
- Suggest the next Git commit.

Never invent functional features, deployment status, evaluation results, or external evidence.

---

# 23. STARTING TASK — EXECUTE NOW

Begin with **Phase 0: Research, Architecture, and Project Planning**.

Perform the following actions in order:

1. Inspect the current workspace.
2. Verify access to both reference repositories.
3. Analyze their real capabilities and limitations.
4. Recommend a practical architecture for Fake News Detection.
5. Create the initial project directory structure.
6. Generate AGENTS.md, MASTER_ORCHESTRATOR.md, PLAN.md, PHASES.md, ROADMAP.md, and ARCHITECTURE.md.
7. Prepare a technology and dependency plan compatible with Mac M2.
8. Identify the smallest useful MVP.
9. Provide precise setup commands for Phase 1.
10. Explain how Priti Kumari should create and connect the GitHub repository.

Do not begin all eleven development phases simultaneously.

After Phase 0, provide a concise completion report with verified deliverables, blockers, and next actions.

**Official Project Owner: Priti Kumari**

**GitHub: [https://github.com/Priti02707](https://github.com/Priti02707)**

**Project:**
