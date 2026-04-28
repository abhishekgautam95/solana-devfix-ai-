# Solana DevFix AI

Solana DevFix AI is a deterministic security scanner for public GitHub repositories that contain Solana, Anchor, or Rust code. It clones a repo into a temporary directory, classifies the project, scans Rust files with rule-based checks, and shows a structured security report in a Next.js dashboard.

This project currently does not use OpenAI APIs and does not create GitHub pull requests. The scanner is intentionally deterministic.

## Current Features

- Public GitHub repo scanning through `POST /scan`
- Safe shallow clone into an operating system temp directory
- Project classification: `anchor`, `solana-rust`, `rust-only`, `unsupported`
- Detection details for repo structure and signals
- Rule-based Rust scanner for common Solana/Anchor security risks
- Risk score with weighted issue severity
- Next.js dashboard with loading, error, empty, and report states

## Workspace Layout

```text
apps/
  api/        Express API server
  web/        Next.js dashboard
packages/
  scanner/    GitHub clone, project detection, scan orchestration
  rules/      Deterministic security rules
  shared/     Zod schemas and shared TypeScript types
docs/
  API.md
  SCANNER.md
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

## Setup

```bash
npm install
```

## Build

```bash
npm run build
```

Builds the TypeScript backend packages and the Next.js frontend.

## Run Locally

Use two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Defaults:

- API: `http://127.0.0.1:3000`
- Web dashboard: `http://127.0.0.1:3001`

Open the dashboard at:

```text
http://127.0.0.1:3001
```

## Environment

Copy the example env file if you want to customize ports or the frontend proxy target.

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

## API Usage

Call the Express API directly:

```bash
curl -s -X POST http://127.0.0.1:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/solana-foundation/anchor"}'
```

When the web app is running, it also exposes a proxy route:

```bash
curl -s -X POST http://127.0.0.1:3001/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/solana-foundation/anchor"}'
```

See [docs/API.md](docs/API.md) for the full request and response contract.

## Project Detection

The scanner returns one of four project types:

- `anchor`: `Anchor.toml` exists, or `programs/` contains an Anchor-style `src/lib.rs`
- `solana-rust`: Rust files contain Solana-specific imports such as `solana_program`, `anchor_lang`, `spl_token`, `solana_sdk`, `Pubkey`, or `pubkey`
- `rust-only`: Rust files exist, but no Solana-specific imports were found
- `unsupported`: no Rust files and no Solana or Anchor signals were found

The UI labels these as:

- `ANCHOR PROJECT`
- `SOLANA RUST`
- `RUST ONLY`
- `UNSUPPORTED`

See [docs/SCANNER.md](docs/SCANNER.md) for detection details, rule behavior, and scoring.

## Security Rules

- `unchecked-account`: detects `UncheckedAccount<'info>`
- `account-info`: detects `AccountInfo<'info>`
- `possible-missing-signer`: detects Anchor account structs that appear authority-sensitive but do not include `Signer<'info>`
- `unsafe-arithmetic`: detects arithmetic operators in Rust files containing `amount`, `balance`, `token`, `withdraw`, or `deposit`
- `missing-tests-folder`: detects missing `tests`, `test`, or `programs/**/tests` folders with severity based on project type
- `possible-missing-pda-validation`: detects PDA-like Anchor account fields without visible `seeds` and `bump` constraints

## Risk Scoring

Each issue contributes to the total score:

- `critical`: +35
- `high`: +25
- `medium`: +12
- `low`: +5
- `info`: +2

The maximum risk score is capped at `100`.

## Important Limitations

- This is a static, rule-based scanner. It can produce false positives and false negatives.
- It does not compile programs or run tests.
- It does not inspect generated IDLs.
- It does not analyze full control flow or data flow.
- It only supports public GitHub HTTPS repository URLs.
- It clones untrusted repositories but does not execute repository code.

## Troubleshooting

If the web dashboard says the scanner API is unavailable, start the backend:

```bash
npm run dev:api
```

If a repo shows `UNSUPPORTED`, check the detection details. The scanner needs Rust files or Solana/Anchor signals to classify it.

If a known Solana repo is classified as `rust-only`, inspect whether its Rust files contain imports such as `solana_program`, `anchor_lang`, `spl_token`, `solana_sdk`, `Pubkey`, or `pubkey`.

## Cleanup Behavior

Clones are created under the operating system temp directory and removed after each scan. The scanner ignores:

- `.git`
- `node_modules`
- `target`
- `dist`
- `build`
- `.next`
