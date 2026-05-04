import { CheckCircle2, FileSearch, ListChecks, Terminal, TextSearch } from "lucide-react";
import type { DiagnosisResult } from "@/lib/diagnosis/schema";
import { ConfidenceBadge } from "./ConfidenceBadge";

type DiagnosisResultCardProps = {
  diagnosis: DiagnosisResult;
};

export function DiagnosisResultCard({ diagnosis }: DiagnosisResultCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              {diagnosis.category.replaceAll("_", " ")} · {diagnosis.generatedBy}
            </p>
            <h2 className="text-2xl font-semibold text-slate-950">{diagnosis.title}</h2>
          </div>
          <ConfidenceBadge confidence={diagnosis.confidence} />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{diagnosis.summary}</p>
      </div>

      <div className="space-y-5 p-5">
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <CheckCircle2 className="h-4 w-4 text-teal-700" />
            Likely root cause
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{diagnosis.rootCause}</p>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <TextSearch className="h-4 w-4 text-teal-700" />
            Why DeployDoctor thinks this
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{diagnosis.reasoning}</p>
          <div className="mt-3 space-y-2">
            {diagnosis.evidenceLines.map((line) => (
              <div
                key={`${line.lineNumber ?? "line"}-${line.text}`}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-5 text-slate-700"
              >
                <span className="mr-2 select-none text-slate-400">
                  {line.lineNumber ? `L${line.lineNumber}` : "log"}
                </span>
                {line.text}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ListChecks className="h-4 w-4 text-teal-700" />
            Next steps
          </h3>
          <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {diagnosis.fixSteps.map((step) => (
              <li key={step} className="rounded-md bg-slate-50 px-3 py-2">
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileSearch className="h-4 w-4 text-teal-700" />
            Files or settings to check
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {diagnosis.filesToCheck.map((file) => (
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
            Commands to try
          </h3>
          <div className="mt-2 space-y-2">
            {diagnosis.commands.map((command) => (
              <code
                key={command}
                className="block rounded-md bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
              >
                {command}
              </code>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Start with: <code className="rounded bg-slate-100 px-1.5 py-0.5">{diagnosis.nextDiagnosticCommand}</code>
          </p>
        </section>
      </div>
    </article>
  );
}
