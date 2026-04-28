"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileCode2,
  GitBranch,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { ProjectType, ScanReport, SecurityIssue, Severity } from "@/lib/types";

const loadingSteps = ["Cloning repository", "Detecting project", "Scanning rules", "Generating report"];

const severityStyles: Record<Severity, string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-sky-200 bg-sky-50 text-sky-700"
};

const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];

const projectTypeLabels: Record<ProjectType, string> = {
  anchor: "ANCHOR PROJECT",
  "solana-rust": "SOLANA RUST",
  "rust-only": "RUST ONLY",
  unsupported: "UNSUPPORTED"
};

export function Dashboard() {
  const [repoUrl, setRepoUrl] = useState("");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const severityCounts = useMemo(() => countBySeverity(report?.issues ?? []), [report]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!repoUrl.trim()) {
      setError("Enter a public GitHub repository URL.");
      setReport(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setReport(null);
    setActiveStep(0);

    const stepTimer = window.setInterval(() => {
      setActiveStep((currentStep) => Math.min(currentStep + 1, loadingSteps.length - 1));
    }, 900);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ repoUrl: repoUrl.trim() })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Scan failed.");
      }

      setActiveStep(loadingSteps.length - 1);
      setReport(payload as ScanReport);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    } finally {
      window.clearInterval(stepTimer);
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-medium text-emerald-700 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Deterministic Solana Security Scanner
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              Solana DevFix AI
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
              Scan public Solana and Anchor repositories for rule-based account validation, signer,
              arithmetic, PDA, and test coverage risks.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Rules" value="6" />
            <Metric label="API" value="/scan" />
            <Metric label="Mode" value="Static" />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="flex flex-col gap-6">
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-panel"
            >
              <label htmlFor="repoUrl" className="text-sm font-semibold text-zinc-950">
                Public GitHub repository
              </label>
              <div className="mt-3 flex flex-col gap-3">
                <div className="relative">
                  <GitBranch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="repoUrl"
                    type="url"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isLoading ? "Scanning" : "Scan repository"}
                </button>
              </div>
            </form>

            <LoadingPanel activeStep={activeStep} isLoading={isLoading} hasReport={Boolean(report)} />

            {error ? <ErrorPanel message={error} /> : null}
          </div>

          <ReportPanel report={report} severityCounts={severityCounts} isLoading={isLoading} />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20 rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function LoadingPanel({
  activeStep,
  isLoading,
  hasReport
}: {
  activeStep: number;
  isLoading: boolean;
  hasReport: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-950">Scan pipeline</h2>
        <span className="text-xs font-medium text-zinc-500">
          {isLoading ? "Running" : hasReport ? "Complete" : "Idle"}
        </span>
      </div>
      <div className="space-y-3">
        {loadingSteps.map((step, index) => {
          const complete = hasReport || activeStep > index;
          const active = isLoading && activeStep === index;

          return (
            <div key={step} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50">
                {complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-zinc-400" />
                )}
              </span>
              <span className={active || complete ? "text-sm font-medium text-zinc-950" : "text-sm text-zinc-500"}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">Scan failed</h2>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
    </section>
  );
}

function ReportPanel({
  report,
  severityCounts,
  isLoading
}: {
  report: ScanReport | null;
  severityCounts: Record<Severity, number>;
  isLoading: boolean;
}) {
  if (!report) {
    return (
      <section className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/75 p-8 text-center shadow-sm">
        <div className="max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Sparkles className="h-5 w-5 text-zinc-500" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">
            {isLoading ? "Preparing report" : "No report yet"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {isLoading
              ? "The scanner is collecting repository data and applying deterministic rules."
              : "Enter a public GitHub repository URL and run a scan to see risk score, severity breakdown, and issues."}
          </p>
        </div>
      </section>
    );
  }

  const hasScannableRust = report.summary.filesScanned > 0;
  const showSolanaRustMessage = report.repo.projectType === "solana-rust" && !report.repo.isAnchorProject;

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-normal text-zinc-600">
                {projectTypeLabels[report.repo.projectType]}
              </span>
              <span
                className={
                  report.repo.isAnchorProject
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                }
              >
                {report.repo.isAnchorProject ? "Anchor project detected" : "Anchor project not detected"}
              </span>
            </div>
            <h2 className="mt-3 break-all text-xl font-semibold text-zinc-950">{report.repo.url}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {report.summary.filesScanned} Rust files scanned, {report.summary.issuesFound} issues found
            </p>
            {showSolanaRustMessage ? (
              <p className="mt-2 text-sm font-medium text-amber-700">
                Solana Rust project detected, but Anchor project layout was not found.
              </p>
            ) : null}
          </div>
          <RiskScore score={report.summary.riskScore} />
        </div>
      </div>

      <DetectionDetails details={report.repo.detectionDetails} />

      {hasScannableRust ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {severityOrder.map((severity) => (
            <SeverityCard key={severity} severity={severity} count={severityCounts[severity]} />
          ))}
        </div>
      ) : null}

      <IssueList report={report} />
    </section>
  );
}

function DetectionDetails({ details }: { details: ScanReport["repo"]["detectionDetails"] }) {
  const items = [
    ["Anchor.toml found", details.anchorTomlFound],
    ["Cargo.toml found", details.cargoTomlFound],
    ["programs folder found", details.programsFolderFound],
    ["Rust files found", details.rustFilesFound],
    ["Solana imports found", details.solanaImportsFound],
    ["tests folder found", details.testsFolderFound]
  ] as const;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-950">Detection details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, found]) => (
          <div key={label} className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className="text-sm text-zinc-700">{label}</span>
            <span
              className={
                found
                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                  : "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-500"
              }
            >
              {found ? "Yes" : "No"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskScore({ score }: { score: number }) {
  const riskTone =
    score >= 75
      ? "border-red-200 bg-red-50 text-red-700"
      : score >= 45
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={`flex min-w-40 items-center gap-3 rounded-lg border px-4 py-3 ${riskTone}`}>
      <ShieldAlert className="h-6 w-6" />
      <div>
        <div className="text-xs font-semibold uppercase tracking-normal">Risk score</div>
        <div className="font-mono text-3xl font-semibold">{score}</div>
      </div>
    </div>
  );
}

function SeverityCard({ severity, count }: { severity: Severity; count: number }) {
  return (
    <div className={`rounded-lg border p-4 ${severityStyles[severity]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold capitalize">{severity}</span>
        <FileCode2 className="h-4 w-4" />
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold">{count}</div>
    </div>
  );
}

function IssueList({ report }: { report: ScanReport }) {
  if (report.summary.filesScanned === 0) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">No Rust program files found</h2>
            <p className="mt-1 text-sm leading-6">
              The repository cloned successfully, but Phase 2 only scans Rust-based Solana and Anchor
              program files. This result means there was no scannable Rust surface, not that the
              repository has been security-cleared.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (report.issues.length === 0) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">No issues found</h2>
            <p className="mt-1 text-sm leading-6">
              The deterministic scanner did not find any matching security rules in this repository.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-950">Issue list</h2>
      </div>
      <div className="divide-y divide-zinc-200">
        {report.issues.map((issue, index) => (
          <article key={`${issue.ruleId}-${issue.filePath}-${issue.lineNumber}-${index}`} className="p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${severityStyles[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs text-zinc-600">
                    {issue.ruleId}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-zinc-950">{issue.title}</h3>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700">
                {issue.filePath === "." ? (
                  <span>Repository check</span>
                ) : (
                  <>
                    <span className="break-all">{issue.filePath}</span>
                    <span className="text-zinc-400">:</span>
                    <span>{issue.lineNumber}</span>
                  </>
                )}
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-700">{issue.description}</p>
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Recommendation</div>
              <p className="mt-1 text-sm leading-6 text-emerald-900">{issue.recommendation}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function countBySeverity(issues: SecurityIssue[]): Record<Severity, number> {
  return issues.reduce<Record<Severity, number>>(
    (counts, issue) => {
      counts[issue.severity] += 1;
      return counts;
    },
    {
      info: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }
  );
}
