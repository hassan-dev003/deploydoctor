import { Activity, ClipboardList, FileSearch, ShieldCheck, Terminal, TextSearch } from "lucide-react";
import type { IncidentReport } from "@/lib/incidents/schema";
import { CopyButton } from "./CopyButton";
import { DiagnosisResultCard } from "./DiagnosisResultCard";

type IncidentReportCardProps = {
  incident: IncidentReport;
};

export function IncidentReportCard({ incident }: IncidentReportCardProps) {
  return (
    <article className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {incident.status.replaceAll("_", " ")} · {incident.sourceType.replaceAll("_", " ")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {incident.diagnosis.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{incident.diagnosis.summary}</p>
          <p className="mt-3 font-mono text-xs text-slate-500">{incident.incidentId}</p>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Activity className="h-4 w-4 text-teal-700" />
              {incident.sourceType === "vercel_api" ? "Agent investigation" : "Investigation timeline"}
            </h3>
            <div className="mt-3 space-y-3">
              {incident.investigationSteps.map((step, index) => (
                <div key={`${step.title}-${index}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    {index < incident.investigationSteps.length - 1 ? (
                      <span className="h-full w-px bg-slate-200" />
                    ) : null}
                  </div>
                  <div className="pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-950">{step.title}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {step.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <TextSearch className="h-4 w-4 text-teal-700" />
              Evidence cards
            </h3>
            <div className="mt-3 space-y-3">
              {incident.evidenceCards.length > 0 ? (
                incident.evidenceCards.map((card) => (
                  <div
                    key={`${card.title}-${card.quote}`}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-950">{card.title}</h4>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                        {card.severity}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs leading-5 text-slate-700">
                      {card.lineNumber ? `L${card.lineNumber} ` : ""}
                      {card.quote}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {card.interpretation}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  No strong evidence lines were found. Paste more lines around the first error.
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ClipboardList className="h-4 w-4 text-teal-700" />
              Repair plan
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{incident.repairPlan.summary}</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {incident.repairPlan.prioritySteps.map((step) => (
                <li key={step} className="rounded-md bg-slate-50 px-3 py-2">
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              Safe actions
            </h3>
            <div className="mt-3 space-y-2">
              {incident.safeActions.map((action) => (
                <div key={action.label} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-950">{action.label}</h4>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                      {action.risk} risk
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FileSearch className="h-4 w-4 text-teal-700" />
              Files and settings to inspect
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {incident.repairPlan.filesToCheck.map((file) => (
                <span
                  key={file}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {file}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Terminal className="h-4 w-4 text-teal-700" />
              Verification commands
            </h3>
            <div className="mt-2 space-y-2">
              {incident.repairPlan.commands.map((command) => (
                <div
                  key={command}
                  className="flex items-start justify-between gap-2 rounded-md bg-slate-950 px-3 py-2"
                >
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-slate-100">
                    {command}
                  </code>
                  <CopyButton value={command} variant="dark" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>First command to run:</span>
              <code className="rounded bg-slate-100 px-1.5 py-0.5">
                {incident.repairPlan.nextDiagnosticCommand}
              </code>
              <CopyButton value={incident.repairPlan.nextDiagnosticCommand} />
            </div>
          </section>
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-950">
          Legacy diagnosis details
        </summary>
        <div className="mt-4">
          <DiagnosisResultCard diagnosis={incident.diagnosis} />
        </div>
      </details>
    </article>
  );
}
