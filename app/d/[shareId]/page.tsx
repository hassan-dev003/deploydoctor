import { CalendarClock, Lock } from "lucide-react";
import { notFound } from "next/navigation";
import { DiagnosisResultCard } from "@/components/diagnosis/DiagnosisResultCard";
import { getDiagnosisShare } from "@/lib/share/shareRepository";
import { ShareIdSchema } from "@/lib/share/shareSchema";

type SharedDiagnosisPageProps = {
  params: Promise<{
    shareId: string;
  }>;
};

export default async function SharedDiagnosisPage({ params }: SharedDiagnosisPageProps) {
  const { shareId } = await params;
  const parsedShareId = ShareIdSchema.safeParse(shareId);

  if (!parsedShareId.success) {
    notFound();
  }

  const share = await getDiagnosisShare(parsedShareId.data);

  if (!share) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4" />
            Public shared diagnosis
          </div>
          <p>
            Anyone with this link can view this sanitized diagnosis. DeployDoctor stores the
            diagnosis result only, not the pasted raw deployment log.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CalendarClock className="h-4 w-4" />
          Saved {new Date(share.createdAt).toLocaleString()}
        </div>

        <DiagnosisResultCard diagnosis={share.diagnosis} />
      </section>
    </main>
  );
}
