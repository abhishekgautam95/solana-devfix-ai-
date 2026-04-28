import type { ProjectType, SecurityIssue, Severity } from "@solana-devfix-ai/shared";

export interface FileRuleContext {
  filePath: string;
  content: string;
  lines: string[];
  isAnchorProject: boolean;
}

export interface RepoRuleContext {
  relativePaths: string[];
  projectType: ProjectType;
  testsFolderFound: boolean;
}

export interface SecurityRule {
  id: string;
  scanFile(context: FileRuleContext): SecurityIssue[];
}

const RUST_INFO_LIFETIME = "\\s*<\\s*'info\\s*>";

function lineNumberForIndex(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function issue(params: SecurityIssue): SecurityIssue {
  return params;
}

function findPatternIssues(
  context: FileRuleContext,
  pattern: RegExp,
  issueFactory: (lineNumber: number) => SecurityIssue
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(context.content)) !== null) {
    issues.push(issueFactory(lineNumberForIndex(context.content, match.index)));
  }

  return issues;
}

const uncheckedAccountRule: SecurityRule = {
  id: "unchecked-account",
  scanFile(context) {
    return findPatternIssues(
      context,
      new RegExp(`\\bUncheckedAccount${RUST_INFO_LIFETIME}`, "g"),
      (lineNumber) =>
        issue({
          ruleId: "unchecked-account",
          title: "Unchecked account usage detected",
          severity: "medium",
          filePath: context.filePath,
          lineNumber,
          description:
            "UncheckedAccount can be risky if owner, signer, or PDA validation is missing.",
          recommendation: "Add proper account constraints or explicit validation checks."
        })
    );
  }
};

const accountInfoRule: SecurityRule = {
  id: "account-info",
  scanFile(context) {
    return findPatternIssues(
      context,
      new RegExp(`\\bAccountInfo${RUST_INFO_LIFETIME}`, "g"),
      (lineNumber) =>
        issue({
          ruleId: "account-info",
          title: "Raw AccountInfo usage detected",
          severity: "medium",
          filePath: context.filePath,
          lineNumber,
          description:
            "AccountInfo bypasses many Anchor account type checks and can be unsafe without manual owner, signer, and data validation.",
          recommendation:
            "Prefer typed Anchor accounts where possible, or validate owner, signer, writability, and account data before use."
        })
    );
  }
};

const possibleMissingSignerRule: SecurityRule = {
  id: "possible-missing-signer",
  scanFile(context) {
    if (!context.isAnchorProject) {
      return [];
    }

    const issues: SecurityIssue[] = [];
    const structPattern =
      /#\s*\[\s*derive\s*\(\s*Accounts\s*\)\s*\][\s\S]*?pub\s+struct\s+(\w+)\s*<\s*'info\s*>\s*\{([\s\S]*?)\n\}/g;
    const authorityWords = /\b(authority|admin|owner|payer|user|manager|operator)\b/i;
    const sensitiveStructWords = /(withdraw|deposit|transfer|mint|burn|update|admin|initialize|close|claim)/i;
    let match: RegExpExecArray | null;

    while ((match = structPattern.exec(context.content)) !== null) {
      const structName = match[1] ?? "Accounts";
      const body = match[2] ?? "";
      const hasSigner = /\bSigner\s*<\s*'info\s*>/.test(body);
      const looksAuthoritySensitive =
        authorityWords.test(body) || sensitiveStructWords.test(structName);

      if (!hasSigner && looksAuthoritySensitive) {
        issues.push(
          issue({
            ruleId: "possible-missing-signer",
            title: "Possible missing Signer account",
            severity: "high",
            filePath: context.filePath,
            lineNumber: lineNumberForIndex(context.content, match.index),
            description:
              "This Anchor account struct appears authority-sensitive but does not include a Signer<'info> account.",
            recommendation:
              "Require Signer<'info> for authorities, or add an explicit #[account(signer)] constraint and manual authorization checks."
          })
        );
      }
    }

    return issues;
  }
};

const unsafeArithmeticRule: SecurityRule = {
  id: "unsafe-arithmetic",
  scanFile(context) {
    const keywordPattern = /\b(amount|balance|token|withdraw|deposit)\b/i;

    if (!keywordPattern.test(context.content) && !keywordPattern.test(context.filePath)) {
      return [];
    }

    const issues: SecurityIssue[] = [];
    const unsafeOperatorPattern = /(^|[^=!<>+\-*/%])([+\-*/%])($|[^=>+\-*/%])/;
    const safeArithmeticPattern = /\.(checked|saturating|wrapping)_(add|sub|mul|div|rem)\b/;

    context.lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (
        !trimmed ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("use ") ||
        trimmed.startsWith("#[") ||
        safeArithmeticPattern.test(trimmed)
      ) {
        return;
      }

      if (unsafeOperatorPattern.test(trimmed) && keywordPattern.test(trimmed)) {
        issues.push(
          issue({
            ruleId: "unsafe-arithmetic",
            title: "Potential unsafe arithmetic detected",
            severity: "high",
            filePath: context.filePath,
            lineNumber: index + 1,
            description:
              "Arithmetic on token, amount, balance, withdraw, or deposit values can overflow, underflow, or round unexpectedly if unchecked.",
            recommendation:
              "Use checked arithmetic such as checked_add, checked_sub, checked_mul, or checked_div and handle failure explicitly."
          })
        );
      }
    });

    return issues;
  }
};

const possibleMissingPdaValidationRule: SecurityRule = {
  id: "possible-missing-pda-validation",
  scanFile(context) {
    if (!context.isAnchorProject) {
      return [];
    }

    const issues: SecurityIssue[] = [];
    const pdaLikeName = /\b(pda|vault|escrow|pool|state|config|treasury|authority)\b/i;

    for (let index = 0; index < context.lines.length; index += 1) {
      const line = context.lines[index] ?? "";

      if (!line.includes("#[account(")) {
        continue;
      }

      const attributeLines: string[] = [line];
      let cursor = index;

      while (cursor < context.lines.length - 1 && !context.lines[cursor]?.includes(")]")) {
        cursor += 1;
        attributeLines.push(context.lines[cursor] ?? "");
      }

      let fieldLineIndex = cursor + 1;
      while (
        fieldLineIndex < context.lines.length &&
        context.lines[fieldLineIndex]?.trim().startsWith("#[")
      ) {
        fieldLineIndex += 1;
      }

      const fieldLine = context.lines[fieldLineIndex] ?? "";
      const fieldMatch = fieldLine.match(/\bpub\s+(\w+)\s*:/);

      if (!fieldMatch) {
        continue;
      }

      const fieldName = fieldMatch[1] ?? "";
      const attribute = attributeLines.join(" ");
      const accountIsSensitive = /\b(init|mut|constraint)\b/.test(attribute);
      const hasSeeds = /\bseeds\s*=/.test(attribute);
      const hasBump = /\bbump\b/.test(attribute);

      if (accountIsSensitive && pdaLikeName.test(fieldName) && (!hasSeeds || !hasBump)) {
        issues.push(
          issue({
            ruleId: "possible-missing-pda-validation",
            title: "Possible missing PDA seeds or bump validation",
            severity: "high",
            filePath: context.filePath,
            lineNumber: index + 1,
            description:
              "This PDA-like account field is mutable, initialized, or constrained without visible seeds and bump validation.",
            recommendation:
              "Add Anchor seeds and bump constraints, or explicitly verify the PDA address with Pubkey::find_program_address."
          })
        );
      }
    }

    return issues;
  }
};

export const SECURITY_RULES: SecurityRule[] = [
  uncheckedAccountRule,
  accountInfoRule,
  possibleMissingSignerRule,
  unsafeArithmeticRule,
  possibleMissingPdaValidationRule
];

export function scanFileWithRules(context: FileRuleContext): SecurityIssue[] {
  return SECURITY_RULES.flatMap((rule) => rule.scanFile(context));
}

export function scanRepositoryRules(context: RepoRuleContext): SecurityIssue[] {
  if (context.testsFolderFound || context.projectType === "unsupported") {
    return [];
  }

  const severityByProjectType: Partial<Record<ProjectType, Severity>> = {
    anchor: "medium",
    "solana-rust": "low",
    "rust-only": "info"
  };
  const severity = severityByProjectType[context.projectType];

  if (!severity) {
    return [];
  }

  return [
    issue({
      ruleId: "missing-tests-folder",
      title: "Missing tests folder",
      severity,
      filePath: ".",
      lineNumber: 1,
      description:
        "No tests folder was found. Security-sensitive Rust and Solana projects should include deterministic tests for validation, signer checks, and token flows.",
      recommendation:
        "Add Anchor or Rust tests under tests/ or programs/<program-name>/tests and cover security-sensitive instructions."
    })
  ];
}
