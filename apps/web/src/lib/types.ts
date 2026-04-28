export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type ProjectType = "anchor" | "solana-rust" | "rust-only" | "unsupported";

export interface SecurityIssue {
  ruleId: string;
  title: string;
  severity: Severity;
  filePath: string;
  lineNumber: number;
  description: string;
  recommendation: string;
}

export interface ScanReport {
  repo: {
    url: string;
    isAnchorProject: boolean;
    projectType: ProjectType;
    detectionDetails: {
      anchorTomlFound: boolean;
      cargoTomlFound: boolean;
      programsFolderFound: boolean;
      rustFilesFound: boolean;
      solanaImportsFound: boolean;
      testsFolderFound: boolean;
    };
  };
  summary: {
    filesScanned: number;
    issuesFound: number;
    riskScore: number;
  };
  issues: SecurityIssue[];
}
