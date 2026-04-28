# Scanner Behavior

The scanner is deterministic. It does not use LLMs, does not execute cloned repository code, and does not create pull requests.

## Scan Flow

1. Validate the repo URL.
2. Normalize the URL to `https://github.com/<owner>/<repo>`.
3. Clone the default branch with `--depth 1 --single-branch`.
4. List files while ignoring generated and dependency directories.
5. Read Rust files.
6. Detect project type.
7. Run file-level security rules.
8. Run repository-level rules.
9. Calculate risk score.
10. Remove the temporary clone.

## Ignored Paths

The scanner ignores:

- `.git`
- `node_modules`
- `target`
- `dist`
- `build`
- `.next`

## Detection Details

Every report includes:

- `anchorTomlFound`
- `cargoTomlFound`
- `programsFolderFound`
- `rustFilesFound`
- `solanaImportsFound`
- `testsFolderFound`

These details explain why a repository was classified the way it was.

## Project Classification

### `anchor`

Returned when either:

- `Anchor.toml` exists
- `programs/<program-name>/src/lib.rs` appears to be Anchor-style, such as containing `anchor_lang`, `#[program]`, or `#[derive(Accounts)]`

### `solana-rust`

Returned when Rust files contain Solana-specific imports or identifiers:

- `solana_program`
- `anchor_lang`
- `spl_token`
- `spl_token_2022`
- `solana_sdk`
- `Pubkey`
- `pubkey`

This can include framework source repositories or custom Solana programs that do not use an Anchor workspace layout.

### `rust-only`

Returned when Rust files exist, but no Solana-specific imports were found.

### `unsupported`

Returned when no Rust files and no Solana or Anchor signals were found.

Unsupported repositories do not receive a missing-tests issue.

## Rules

### `unchecked-account`

Detects:

```rust
UncheckedAccount<'info>
```

Severity: `medium`

Reason: unchecked accounts require explicit owner, signer, PDA, and data validation.

### `account-info`

Detects:

```rust
AccountInfo<'info>
```

Severity: `medium`

Reason: raw account access bypasses many Anchor type-level checks.

### `possible-missing-signer`

Detects Anchor account structs that appear authority-sensitive but do not include:

```rust
Signer<'info>
```

Severity: `high`

Only runs when the project is classified as `anchor`.

### `unsafe-arithmetic`

Detects arithmetic operators in lines that mention:

- `amount`
- `balance`
- `token`
- `withdraw`
- `deposit`

Severity: `high`

Recommendation: use checked arithmetic such as `checked_add`, `checked_sub`, `checked_mul`, or `checked_div`.

### `possible-missing-pda-validation`

Detects PDA-like mutable or initialized Anchor accounts without visible `seeds` and `bump`.

Severity: `high`

Only runs when the project is classified as `anchor`.

### `missing-tests-folder`

Detects missing test folders:

- `tests`
- `test`
- `programs/<program-name>/tests`

Severity depends on project type:

- `anchor`: `medium`
- `solana-rust`: `low`
- `rust-only`: `info`
- `unsupported`: omitted

## Risk Score

The score is additive and capped at `100`.

| Severity | Points |
| --- | ---: |
| `critical` | 35 |
| `high` | 25 |
| `medium` | 12 |
| `low` | 5 |
| `info` | 2 |

## Known Limitations

- Regex and heuristic matching can create false positives.
- The scanner does not compile Rust or Anchor projects.
- The scanner does not run tests.
- The scanner does not perform control-flow or data-flow analysis.
- The scanner does not validate whether a reported issue is exploitable.
- The scanner is best treated as an early warning system, not a full audit.
