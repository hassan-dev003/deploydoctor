"use client";

import { AlertTriangle, Clipboard, ClipboardPaste, Link2, Lock, Share2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { MAX_LOG_CHARS, oversizedLogMessage } from "@/lib/diagnosis/constants";
import { sampleLogs } from "@/lib/diagnosis/samples";
import { analyzePastedIncident } from "@/lib/incidents/incidentAdapter";
import { saveIncidentForSharing } from "@/lib/incidents/shareAdapter";
import type { IncidentReport } from "@/lib/incidents/schema";
import { IncidentReportCard } from "./IncidentReportCard";

const emptyMessage = "Paste deployment logs before running an incident analysis.";

export function DiagnosisWorkspace() {
  const [rawLog, setRawLog] = useState("");
  const [incident, setIncident] = useState<IncidentReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const trimmedLog = rawLog.trim();
  const lineCount = useMemo(
    () => (trimmedLog.length === 0 ? 0 : trimmedLog.split(/\r?\n/).length),
    [trimmedLog]
  );

  async function handleAnalyze() {
    if (!trimmedLog) {
      setError(emptyMessage);
      setIncident(null);
      return;
    }

    if (trimmedLog.length > MAX_LOG_CHARS) {
      setError(oversizedLogMessage);
      setIncident(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzePastedIncident(trimmedLog);
      setIncident(result);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "DeployDoctor could not analyze this log. Try a shorter excerpt around the first error."
      );
      setIncident(null);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-5">
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-sm font-medium text-teal-800 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Evidence-backed incident reports
            </div>
            <div className="space-y-2">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
                Turn failed Vercel deployments into evidence-backed incident reports.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Paste the relevant build output. DeployDoctor redacts obvious secrets, traces the
                likely failure, and produces an incident report with evidence, repair steps, and safe actions.
              </p>
            </div>
          </header>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Deployment log</h2>
                <p className="text-sm text-slate-500">{lineCount} lines pasted</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {sampleLogs.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      setRawLog(sample.log);
                      setError(null);
                      setShareError(null);
                      setShareUrl(null);
                      setIncident(null);
                    }}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                    title={sample.description}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 p-4">
              <label className="sr-only" htmlFor="deployment-log">
                Paste deployment logs
              </label>
              <textarea
                id="deployment-log"
                value={rawLog}
                onChange={(event) => {
                  setRawLog(event.target.value);
                  setError(null);
                  setShareError(null);
                  setShareUrl(null);
                }}
                spellCheck={false}
                placeholder="Paste the failed Vercel deployment log here..."
                className="min-h-[380px] w-full resize-y rounded-md border border-slate-300 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none ring-teal-500 transition placeholder:text-slate-500 focus:border-teal-500 focus:ring-2"
              />

              <div className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Privacy note: raw logs stay in React state until you analyze. The server redacts
                  obvious secrets before model calls or evidence display. Sharing saves only sanitized
                  diagnosis data, never the pasted raw log.
                </p>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  {isAnalyzing ? "Analyzing..." : "Analyze pasted log"}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={!incident || isSharing}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:border-slate-200"
                  title={
                    incident
                      ? "Create a DB-backed public link for this sanitized incident report."
                      : "Analyze a log before sharing."
                  }
                >
                  <Share2 className="h-4 w-4" />
                  {isSharing ? "Creating link..." : "Share incident"}
                </button>
              </div>

              {shareError ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{shareError}</p>
                </div>
              ) : null}

              {shareUrl ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Link2 className="h-4 w-4 text-teal-700" />
                    Shareable incident URL
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={shareUrl}
                      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(shareUrl)}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                    >
                      <Clipboard className="h-4 w-4" />
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="lg:pt-28">
          {incident ? (
            <IncidentReportCard incident={incident} />
          ) : (
            <div className="space-y-4 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Incident report preview</h2>
              <p className="mt-2 text-sm leading-6">
                Pick a sample above for a fast demo, then analyze it to generate a timeline,
                evidence cards, repair plan, safe actions, and a sanitized share link.
              </p>
              <div className="grid gap-3 text-sm">
                <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-teal-900">
                  <div className="font-semibold">Does</div>
                  <p className="mt-1 leading-6">
                    Pasted log analysis, redaction, evidence-backed reports, sanitized sharing.
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-700">
                  <div className="font-semibold">Does not yet</div>
                  <p className="mt-1 leading-6">
                    Read private Vercel logs from public URLs, connect Vercel accounts, inspect
                    GitHub diffs, or auto-push fixes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );

  async function handleShare() {
    if (!incident) {
      return;
    }

    setIsSharing(true);
    setShareError(null);

    try {
      const saved = await saveIncidentForSharing(incident);
      setShareUrl(saved.url);
    } catch (caughtError) {
      setShareUrl(null);
      setShareError(
        caughtError instanceof Error
          ? caughtError.message
          : "DeployDoctor could not create an incident link."
      );
    } finally {
      setIsSharing(false);
    }
  }
}
