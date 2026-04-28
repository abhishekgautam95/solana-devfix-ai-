import { z } from "zod";

export const ScanRequestSchema = z.object({
  repoUrl: z.string().url()
});

export const SeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);

export const IssueSchema = z.object({
  ruleId: z.string(),
  title: z.string(),
  severity: SeveritySchema,
  filePath: z.string(),
  lineNumber: z.number().int().positive(),
  description: z.string(),
  recommendation: z.string()
});

export const ProjectTypeSchema = z.enum(["anchor", "solana-rust", "rust-only", "unsupported"]);

export const DetectionDetailsSchema = z.object({
  anchorTomlFound: z.boolean(),
  cargoTomlFound: z.boolean(),
  programsFolderFound: z.boolean(),
  rustFilesFound: z.boolean(),
  solanaImportsFound: z.boolean(),
  testsFolderFound: z.boolean()
});

export const ScanReportSchema = z.object({
  repo: z.object({
    url: z.string().url(),
    isAnchorProject: z.boolean(),
    projectType: ProjectTypeSchema,
    detectionDetails: DetectionDetailsSchema
  }),
  summary: z.object({
    filesScanned: z.number().int().nonnegative(),
    issuesFound: z.number().int().nonnegative(),
    riskScore: z.number().int().min(0).max(100)
  }),
  issues: z.array(IssueSchema)
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type SecurityIssue = z.infer<typeof IssueSchema>;
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type DetectionDetails = z.infer<typeof DetectionDetailsSchema>;
export type ScanReport = z.infer<typeof ScanReportSchema>;
