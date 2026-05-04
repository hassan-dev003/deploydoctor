"use client";

import { AlertTriangle, ClipboardPaste, Lock, Share2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { MAX_LOG_CHARS, oversizedLogMessage } from "@/lib/diagnosis/constants";
import { analyzePastedLog } from "@/lib/diagnosis/diagnosisAdapter";
import { sampleLogs } from "@/lib/diagnosis/samples";
import type { DiagnosisResult } from "@/lib/diagnosis/schema";
import { DiagnosisResultCard } from "./DiagnosisResultCard";

const emptyMessage = "Paste deployment logs before running a diagnosis.";

export function DiagnosisWorkspace() {
  const [rawLog, setRawLog] = useState("");
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLog = rawLog.trim();
  const lineCount = useMemo(
    () => (trimmedLog.length === 0 ? 0 : trimmedLog.split(/\r?\n/).length),
    [trimmedLog]
  );

  async function handleAnalyze() {
    if (!trimmedLog) {
      setError(emptyMessage);
      setDiagnosis(null);
      return;
    }

    if (trimmedLog.length > MAX_LOG_CHARS) {
      setError(oversizedLogMessage);
      setDiagnosis(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzePastedLog(trimmedLog);
      setDiagnosis(result);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "DeployDoctor could not analyze this log. Try a shorter excerpt around the first error."
      );
      setDiagnosis(null);
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
              Milestone 2: server diagnosis with mock fallback
            </div>
            <div className="space-y-2">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
                Paste a failed Vercel build log. Get the next fix to try.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                DeployDoctor reads the noisy parts of a deployment log, identifies the likely failure type,
                and turns it into a practical repair checklist.
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
                      setDiagnosis(null);
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
                }}
                spellCheck={false}
                placeholder="Paste the failed Vercel deployment log here..."
                className="min-h-[380px] w-full resize-y rounded-md border border-slate-300 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none ring-teal-500 transition placeholder:text-slate-500 focus:border-teal-500 focus:ring-2"
              />

              <div className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Privacy note: raw logs stay in React state until you analyze. The server redacts
                  obvious secrets before model calls or evidence display. Nothing is saved, shared,
                  or placed in the URL.
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
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400"
                  title="DB-backed share pages arrive in Milestone 3."
                >
                  <Share2 className="h-4 w-4" />
                  Share diagnosis later
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:pt-28">
          {diagnosis ? (
            <DiagnosisResultCard diagnosis={diagnosis} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Diagnosis preview</h2>
              <p className="mt-2 text-sm leading-6">
                Choose a sample log or paste your own failed deployment output. The API returns the
                same structured result whether OpenAI succeeds or DeployDoctor falls back to the mock
                diagnosis path.
              </p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
