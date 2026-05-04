import { randomBytes } from "node:crypto";
import { redactSecrets } from "@/lib/diagnosis/redact";
import type { DiagnosisResult, EvidenceLine } from "@/lib/diagnosis/schema";
import { IncidentReportSchema, type IncidentReport } from "./schema";

export function createIncidentId(): string {
  return `inc_${randomBytes(8).toString("hex")}`;
}

export function generateIncidentReport(
  diagnosis: DiagnosisResult,
  incidentId = createIncidentId()
): IncidentReport {
  const status = diagnosis.category === "unknown" ? "needs_more_evidence" : "needs_action";
  const evidenceCards = diagnosis.evidenceLines.map((line) =>
    evidenceLineToCard(line, diagnosis)
  );

  return IncidentReportSchema.parse({
    incidentId,
    createdAt: new Date().toISOString(),
    sourceType: "pasted_log",
    status,
    diagnosis,
    investigationSteps: [
      {
        title: "Ingested pasted deployment log",
        status: "completed",
        summary:
          "DeployDoctor analyzed only the pasted text and did not fetch private Vercel logs or external project data."
      },
      {
        title: "Redacted sensitive-looking values",
        status: "completed",
        summary:
          "Obvious secrets were removed before model analysis, evidence display, or share persistence."
      },
      {
        title: "Classified likely failure mode",
        status: "completed",
        summary: `The incident matches ${diagnosis.category.replaceAll("_", " ")} with ${Math.round(
          diagnosis.confidence * 100
        )}% confidence.`
      },
      {
        title: status === "needs_action" ? "Prepared repair plan" : "Needs more evidence",
        status: status === "needs_action" ? "completed" : "needs_action",
        summary:
          status === "needs_action"
            ? "The report includes concrete checks and commands to verify the suspected root cause."
            : "Paste more lines around the first error before making a code or settings change."
      }
    ],
    evidenceCards,
    repairPlan: {
      summary: diagnosis.rootCause,
      prioritySteps: diagnosis.fixSteps,
      commands: diagnosis.commands,
      filesToCheck: diagnosis.filesToCheck,
      nextDiagnosticCommand: diagnosis.nextDiagnosticCommand
    },
    safeActions: buildSafeActions(diagnosis)
  });
}

function evidenceLineToCard(line: EvidenceLine, diagnosis: DiagnosisResult) {
  return {
    title: line.lineNumber ? `Log evidence at line ${line.lineNumber}` : "Log evidence",
    severity: severityForCategory(diagnosis.category),
    lineNumber: line.lineNumber,
    quote: redactSecrets(line.text),
    interpretation:
      diagnosis.category === "unknown"
        ? "This line is useful context, but it is not enough to identify a specific failure mode."
        : `This line supports the ${diagnosis.category.replaceAll("_", " ")} classification.`
  };
}

function severityForCategory(category: DiagnosisResult["category"]) {
  if (category === "unknown") {
    return "info" as const;
  }

  if (category === "build_command_error") {
    return "warning" as const;
  }

  return "critical" as const;
}

function buildSafeActions(diagnosis: DiagnosisResult): IncidentReport["safeActions"] {
  const safeActions: IncidentReport["safeActions"] = [
    {
      label: "Run the first diagnostic command locally",
      description: `Start with ${diagnosis.nextDiagnosticCommand} to reproduce the failure before changing production settings.`,
      risk: "low" as const
    },
    {
      label: "Check the cited files or settings",
      description:
        "Inspect the files and settings named in the report before editing unrelated parts of the app.",
      risk: "low" as const
    },
    {
      label: "Share the sanitized incident report",
      description:
        "Create a public report link for collaborators; DeployDoctor stores sanitized report data, not the pasted raw log.",
      risk: "low" as const
    }
  ];

  if (diagnosis.category === "missing_env_var") {
    safeActions.push({
      label: "Verify Vercel environment scope",
      description:
        "Confirm whether the missing value belongs to Production, Preview, or Development before redeploying.",
      risk: "medium" as const
    });
  }

  return safeActions;
}
