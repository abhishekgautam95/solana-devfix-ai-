# API Reference

The backend API is an Express server in `apps/api`. The Next.js dashboard also exposes a proxy route at `/api/scan` that forwards to the Express API configured by `SCAN_API_URL`.

## Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

## Scan Repository

```http
POST /scan
```

Request body:

```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

Only public `https://github.com/<owner>/<repo>` URLs are supported.

Example:

```bash
curl -s -X POST http://127.0.0.1:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/solana-foundation/anchor"}'
```

## Response

```json
{
  "repo": {
    "url": "https://github.com/owner/repo",
    "isAnchorProject": false,
    "projectType": "solana-rust",
    "detectionDetails": {
      "anchorTomlFound": false,
      "cargoTomlFound": true,
      "programsFolderFound": false,
      "rustFilesFound": true,
      "solanaImportsFound": true,
      "testsFolderFound": true
    }
  },
  "summary": {
    "filesScanned": 273,
    "issuesFound": 1398,
    "riskScore": 100
  },
  "issues": [
    {
      "ruleId": "account-info",
      "title": "Raw AccountInfo usage detected",
      "severity": "medium",
      "filePath": "lang/src/context.rs",
      "lineNumber": 33,
      "description": "AccountInfo bypasses many Anchor account type checks and can be unsafe without manual owner, signer, and data validation.",
      "recommendation": "Prefer typed Anchor accounts where possible, or validate owner, signer, writability, and account data before use."
    }
  ]
}
```

## Project Types

`projectType` can be:

- `anchor`
- `solana-rust`
- `rust-only`
- `unsupported`

## Severities

`severity` can be:

- `critical`
- `high`
- `medium`
- `low`
- `info`

## Error Responses

Invalid body:

```json
{
  "error": "Invalid request body",
  "details": {
    "formErrors": [],
    "fieldErrors": {
      "repoUrl": ["Invalid url"]
    }
  }
}
```

Unsupported URL:

```json
{
  "error": "Only public https://github.com/<owner>/<repo> URLs are supported."
}
```

Clone failure:

```json
{
  "error": "Failed to clone repository: ..."
}
```
