# Solana DevFix AI

Deterministic security scanning for public Solana, Anchor, and Rust repositories.

Solana DevFix AI clones a public GitHub repository into a temporary directory, classifies the project, scans Rust source files with rule-based checks, and presents the results in a clean Next.js dashboard. It is designed as an early-warning tool for common Solana and Anchor security patterns, not as a replacement for a full audit.

## Status

This repository currently includes:

- A TypeScript/Express scanner API
- A Next.js dashboard
- Deterministic rule-based scanning
- Project classification and detection details
- Weighted risk scoring
- API and scanner documentation

This version does not use LLM APIs, execute repository code, or create GitHub pull requests.

## Features

- Scan public GitHub repositories with `POST /scan`
- Shallow-clone repositories into OS-managed temporary storage
- Detect `anchor`, `solana-rust`, `rust-only`, and `unsupported` project types
- Report structural detection signals such as `Anchor.toml`, `Cargo.toml`, Rust files, Solana imports, and tests
- Identify common Solana/Anchor security concerns with deterministic rules
- Produce a structured JSON report with severity, file path, line number, description, and recommendation
- Display risk score, severity breakdown, issue list, loading states, empty states, and error states in the dashboard

## Architecture

```text
apps/
  api/          Express API server
  web/          Next.js dashboard

packages/
  scanner/      Repository cloning, project detection, scan orchestration
  rules/        Deterministic security rules
  shared/       Shared Zod schemas and TypeScript types

docs/
  API.md        API contract and example responses
  SCANNER.md    Detection, rules, scoring, and limitations
```

## Tech Stack

- Node.js
- TypeScript
- Express
- Next.js
- Tailwind CSS
- simple-git
- zod
- fs-extra
- fast-glob

## Quick Start

Install dependencies:

```bash
npm install
```

Build the API packages and web dashboard:

```bash
npm run build
```

Run the backend API:

```bash
npm run dev:api
```

Run the web dashboard in a second terminal:

```bash
npm run dev:web
```

Open:

```text
http://127.0.0.1:3001
```

Default services:

| Service | URL |
| --- | --- |
| API | `http://127.0.0.1:3000` |
| Dashboard | `http://127.0.0.1:3001` |

## Configuration

Create a local environment file if you need to customize ports or the scanner API target:

```bash
cp .env.example .env
```

Supported variables:

```env
PORT=3000
HOST=127.0.0.1
SCAN_TIMEOUT_MS=120000
SCAN_API_URL=http://127.0.0.1:3000/scan
```

## API Example

Call the Express API directly:

```bash
curl -s -X POST http://127.0.0.1:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/solana-foundation/anchor"}'
```

Or call the Next.js proxy route used by the dashboard:

```bash
curl -s -X POST http://127.0.0.1:3001/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/solana-foundation/anchor"}'
```

See [docs/API.md](docs/API.md) for the complete request and response contract.

## Project Classification

The scanner classifies repositories into one of four project types.

| Project Type | Meaning |
| --- | --- |
| `anchor` | `Anchor.toml` exists, or `programs/` contains an Anchor-style `src/lib.rs` |
| `solana-rust` | Rust files contain Solana-specific imports or identifiers |
| `rust-only` | Rust files exist, but no Solana-specific imports were found |
| `unsupported` | No Rust files and no Solana or Anchor signals were found |

The dashboard displays these labels as:

- `ANCHOR PROJECT`
- `SOLANA RUST`
- `RUST ONLY`
- `UNSUPPORTED`

See [docs/SCANNER.md](docs/SCANNER.md) for detailed detection rules.

## Security Rules

Current deterministic rules:

| Rule | Purpose |
| --- | --- |
| `unchecked-account` | Detects `UncheckedAccount<'info>` usage |
| `account-info` | Detects raw `AccountInfo<'info>` usage |
| `possible-missing-signer` | Flags authority-sensitive Anchor account structs without `Signer<'info>` |
| `unsafe-arithmetic` | Flags arithmetic on token, amount, balance, withdraw, or deposit values |
| `missing-tests-folder` | Flags missing test directories with project-aware severity |
| `possible-missing-pda-validation` | Flags PDA-like Anchor accounts without visible `seeds` and `bump` constraints |

## Risk Scoring

Each issue contributes points to a capped score of `100`.

| Severity | Points |
| --- | ---: |
| `critical` | 35 |
| `high` | 25 |
| `medium` | 12 |
| `low` | 5 |
| `info` | 2 |

## Scripts

| Script | Description |
| --- | --- |
| `npm run build` | Build backend packages and the web dashboard |
| `npm run build:api` | Build TypeScript backend packages only |
| `npm run build:web` | Build the Next.js dashboard only |
| `npm run dev:api` | Start the Express API |
| `npm run dev:web` | Start the Next.js dashboard |
| `npm run clean` | Clean TypeScript build output |

## Documentation

- [API Reference](docs/API.md)
- [Scanner Behavior](docs/SCANNER.md)

## Security Model

The scanner treats repositories as untrusted input.

- Repositories are shallow-cloned.
- Repository code is not executed.
- Clones are removed after scanning.
- Generated and dependency directories are ignored.

Ignored paths:

- `.git`
- `node_modules`
- `target`
- `dist`
- `build`
- `.next`

## Limitations

- Static heuristics can produce false positives and false negatives.
- The scanner does not compile Rust or Anchor programs.
- The scanner does not run tests.
- The scanner does not inspect generated IDLs.
- The scanner does not perform full control-flow or data-flow analysis.
- Only public GitHub HTTPS repository URLs are supported.

Use the report as a prioritization aid before manual review, not as proof that a program is secure.

## Troubleshooting

If the dashboard reports that the scanner API is unavailable, start the backend:

```bash
npm run dev:api
```

If a repository is classified as `UNSUPPORTED`, review the detection details in the dashboard. The scanner needs Rust files or Solana/Anchor signals to classify a repository.

If a known Solana repository is classified as `RUST ONLY`, check whether its Rust files contain imports or identifiers such as `solana_program`, `anchor_lang`, `spl_token`, `solana_sdk`, `Pubkey`, or `pubkey`.

## Roadmap

Potential next phases:

- Add focused unit tests for detection and rule behavior
- Add more Solana-specific static rules
- Add repository scan history
- Add authenticated GitHub integration
- Add optional PR generation
- Add AI-assisted explanations after deterministic findings are stable

## License

No license has been added yet. Add one before distributing or accepting external contributions.
