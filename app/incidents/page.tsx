import { AlertTriangle, ArrowLeft, CalendarClock, FileText, Inbox, Lock } from "lucide-react";
import Link from "next/link";
import { listStoredIncidents } from "@/lib/incidents/storageRepository";
import { getPostgresUrl, ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";

export const dynamic = "force-dynamic";

export default async function IncidentInboxPage() {
  const isConfigured = Boolean(getPostgresUrl());
  const incidents = isConfigured ? await loadIncidents() : [];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-teal-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to analyzer
        </Link>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-sm font-medium text-teal-800 shadow-sm">
            <Inbox className="h-4 w-4" />
            Internal incident inbox
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
            Vercel webhook incidents
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            This page lists incidents created from Vercel deployment failure webhooks. Connected
            projects can include fetched, sanitized deployment evidence; unconnected projects stay
            metadata-only.
          </p>
        </header>

        {!isConfigured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Incident inbox is not configured
            </div>
            <p>
              Set `POSTGRES_URL` or `depdoc_POSTGRES_URL` to store and list webhook-created
              incidents. Paste-log analysis still works without database storage.
            </p>
          </div>
        ) : null}

        {isConfigured && incidents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No webhook-created incidents have been stored yet.
          </div>
        ) : null}

        <div className="space-y-3">
          {incidents.map((incident) => (
            <article
              key={incident.incidentId}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500">{incident.incidentId}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{incident.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{incident.summary}</p>
                </div>
                <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
                  {incident.sourceType.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    incident.incident
                      ? "bg-teal-50 text-teal-800"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {incident.incident ? "Full analysis" : "Metadata only"}
                </span>
                {!incident.incident ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    Needs connection
                  </span>
                ) : null}
                <Link
                  href={`/incidents/${incident.incidentId}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1 text-xs font-medium text-white transition hover:bg-teal-800"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Open incident
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {new Date(incident.createdAt).toLocaleString()}
                </span>
                {incident.projectId ? <span>Project: {incident.projectId}</span> : null}
                {incident.deploymentId ? <span>Deployment: {incident.deploymentId}</span> : null}
                {incident.deploymentUrl ? <span>URL: {incident.deploymentUrl}</span> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950">
            <Lock className="h-4 w-4" />
            Storage note
          </div>
          <p>
            Stored webhook incidents contain sanitized webhook metadata and, when authorized,
            sanitized incident reports generated from fetched Vercel deployment events. Raw
            deployment logs are not persisted.
          </p>
        </div>
      </section>
    </main>
  );
}

async function loadIncidents() {
  try {
    return await listStoredIncidents();
  } catch (error) {
    if (error instanceof ShareDatabaseUnavailableError) {
      return [];
    }

    throw error;
  }
}
