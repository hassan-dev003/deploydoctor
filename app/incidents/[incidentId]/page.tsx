import { AlertTriangle, ArrowLeft, CalendarClock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncidentReportCard } from "@/components/diagnosis/IncidentReportCard";
import { getStoredIncident } from "@/lib/incidents/storageRepository";
import { ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";

export const dynamic = "force-dynamic";

type IncidentDetailPageProps = {
  params: Promise<{
    incidentId: string;
  }>;
};

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { incidentId } = await params;
  const incident = await loadIncident(incidentId);

  if (!incident) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-4">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-teal-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to incident inbox
        </Link>

        {incident.incident ? (
          <IncidentReportCard incident={incident.incident} />
        ) : (
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Metadata-only incident
            </div>
            <h1 className="text-2xl font-semibold text-slate-950">{incident.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{incident.summary}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(incident.createdAt).toLocaleString()}
              </span>
              {incident.projectId ? <span>Project: {incident.projectId}</span> : null}
              {incident.deploymentId ? <span>Deployment: {incident.deploymentId}</span> : null}
              {incident.deploymentUrl ? <span>URL: {incident.deploymentUrl}</span> : null}
            </div>
          </article>
        )}
      </section>
    </main>
  );
}

async function loadIncident(incidentId: string) {
  try {
    return await getStoredIncident(incidentId);
  } catch (error) {
    if (error instanceof ShareDatabaseUnavailableError) {
      return null;
    }

    throw error;
  }
}
