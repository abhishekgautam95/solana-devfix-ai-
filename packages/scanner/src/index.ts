import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import fg from "fast-glob";
import fs from "fs-extra";
import simpleGit from "simple-git";
import { scanFileWithRules, scanRepositoryRules } from "@solana-devfix-ai/rules";
import type { DetectionDetails, ProjectType, ScanReport, SecurityIssue, Severity } from "@solana-devfix-ai/shared";

const IGNORE_DIRECTORIES = ["node_modules", "target", ".git", "dist", "build", ".next"];
const IGNORE_PATTERNS = IGNORE_DIRECTORIES.map((directory) => `**/${directory}/**`);

export interface ScanOptions {
  timeoutMs?: number;
}

interface ProjectDetection {
  isAnchorProject: boolean;
  projectType: ProjectType;
  details: DetectionDetails;
}

interface RustFileData {
  relativePath: string;
  content: string;
  lines: string[];
}

interface NormalizedGithubRepo {
  publicUrl: string;
  cloneUrl: string;
}

export class ScannerError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500
  ) {
    super(message);
    this.name = "ScannerError";
  }
}

export async function scanGithubRepository(repoUrl: string, options: ScanOptions = {}): Promise<ScanReport> {
  const normalizedRepo = normalizeGithubRepoUrl(repoUrl);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "solana-devfix-ai-"));
  const repoPath = path.join(tempRoot, "repo");

  try {
    await cloneRepository(normalizedRepo.cloneUrl, repoPath, options.timeoutMs);

    const relativePaths = await listRepositoryFiles(repoPath);
    const rustFiles = relativePaths.filter((relativePath) => relativePath.endsWith(".rs"));
    const rustFileData = await readRustFiles(repoPath, rustFiles);
    const detection = await detectProject(repoPath, relativePaths, rustFileData);
    const issues: SecurityIssue[] = [];

    for (const rustFile of rustFileData) {
      issues.push(
        ...scanFileWithRules({
          filePath: rustFile.relativePath,
          content: rustFile.content,
          lines: rustFile.lines,
          isAnchorProject: detection.isAnchorProject
        })
      );
    }

    issues.push(
      ...scanRepositoryRules({
        relativePaths,
        projectType: detection.projectType,
        testsFolderFound: detection.details.testsFolderFound
      })
    );

    return {
      repo: {
        url: normalizedRepo.publicUrl,
        isAnchorProject: detection.isAnchorProject,
        projectType: detection.projectType,
        detectionDetails: detection.details
      },
      summary: {
        filesScanned: rustFiles.length,
        issuesFound: issues.length,
        riskScore: calculateRiskScore(issues)
      },
      issues
    };
  } finally {
    await fs.remove(tempRoot);
  }
}

function normalizeGithubRepoUrl(repoUrl: string): NormalizedGithubRepo {
  let parsed: URL;

  try {
    parsed = new URL(repoUrl);
  } catch {
    throw new ScannerError("repoUrl must be a valid public GitHub HTTPS URL.", 400);
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new ScannerError("Only public https://github.com/<owner>/<repo> URLs are supported.", 400);
  }

  const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new ScannerError("GitHub URL must include an owner and repository name.", 400);
  }

  const owner = sanitizeGithubPathPart(parts[0]);
  const repo = sanitizeGithubPathPart(parts[1].replace(/\.git$/i, ""));

  return {
    publicUrl: `https://github.com/${owner}/${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`
  };
}

function sanitizeGithubPathPart(part: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(part)) {
    throw new ScannerError("GitHub owner and repository names may only contain letters, numbers, dots, dashes, and underscores.", 400);
  }

  return part;
}

async function cloneRepository(repoUrl: string, repoPath: string, timeoutMs = 120_000): Promise<void> {
  const git = simpleGit({
    timeout: {
      block: timeoutMs
    }
  });

  try {
    await git.clone(repoUrl, repoPath, ["--depth", "1", "--single-branch"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown git clone error";
    throw new ScannerError(`Failed to clone repository: ${message}`, 422);
  }
}

async function listRepositoryFiles(repoPath: string): Promise<string[]> {
  return fg("**/*", {
    cwd: repoPath,
    dot: true,
    onlyFiles: false,
    ignore: IGNORE_PATTERNS,
    unique: true
  });
}

async function readRustFiles(repoPath: string, rustFiles: string[]): Promise<RustFileData[]> {
  const files: RustFileData[] = [];

  for (const relativePath of rustFiles) {
    const absolutePath = path.join(repoPath, relativePath);
    const content = await fs.readFile(absolutePath, "utf8");

    files.push({
      relativePath,
      content,
      lines: content.split(/\r?\n/)
    });
  }

  return files;
}

async function detectProject(
  repoPath: string,
  relativePaths: string[],
  rustFiles: RustFileData[]
): Promise<ProjectDetection> {
  const pathSet = new Set(relativePaths);
  const hasAnchorToml = pathSet.has("Anchor.toml");
  const hasCargoToml = pathSet.has("Cargo.toml");
  const hasProgramsDirectory = await fs.pathExists(path.join(repoPath, "programs"));
  const hasRustFiles = rustFiles.length > 0;
  const hasSolanaImports = rustFiles.some((rustFile) => hasSolanaSpecificImport(rustFile.content));
  const hasTestsFolder = relativePaths.some((relativePath) =>
    /(^|\/)(tests?|programs\/[^/]+\/tests)(\/|$)/.test(relativePath)
  );
  const hasAnchorStyleProgram = hasProgramsDirectory && rustFiles.some(isAnchorStyleProgramFile);
  const isAnchorProject = hasAnchorToml || hasAnchorStyleProgram;
  const details: DetectionDetails = {
    anchorTomlFound: hasAnchorToml,
    cargoTomlFound: hasCargoToml,
    programsFolderFound: hasProgramsDirectory,
    rustFilesFound: hasRustFiles,
    solanaImportsFound: hasSolanaImports,
    testsFolderFound: hasTestsFolder
  };

  if (isAnchorProject) {
    return {
      isAnchorProject: true,
      projectType: "anchor",
      details
    };
  }

  if (hasSolanaImports) {
    return {
      isAnchorProject: false,
      projectType: "solana-rust",
      details
    };
  }

  if (hasRustFiles) {
    return {
      isAnchorProject: false,
      projectType: "rust-only",
      details
    };
  }

  return {
    isAnchorProject: false,
    projectType: "unsupported",
    details
  };
}

function hasSolanaSpecificImport(content: string): boolean {
  return /\b(solana_program|anchor_lang|spl_token(?:_2022)?|solana_sdk|Pubkey|pubkey)\b/.test(content);
}

function isAnchorStyleProgramFile(rustFile: RustFileData): boolean {
  if (!/^programs\/[^/]+\/src\/lib\.rs$/.test(rustFile.relativePath)) {
    return false;
  }

  return (
    /\banchor_lang\b/.test(rustFile.content) ||
    /#\s*\[\s*program\s*\]/.test(rustFile.content) ||
    /#\s*\[\s*derive\s*\(\s*Accounts\s*\)\s*\]/.test(rustFile.content)
  );
}

function calculateRiskScore(issues: SecurityIssue[]): number {
  const weights: Record<Severity, number> = {
    info: 2,
    low: 5,
    medium: 12,
    high: 25,
    critical: 35
  };

  const rawScore = issues.reduce((score, currentIssue) => score + weights[currentIssue.severity], 0);
  return Math.min(100, rawScore);
}
