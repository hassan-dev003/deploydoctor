import { describe, expect, it } from "vitest";
import { generateMockDiagnosis } from "@/lib/diagnosis/generateMockDiagnosis";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";
import { IncidentReportSchema } from "@/lib/incidents/schema";

describe("generateIncidentReport", () => {
  it("wraps a diagnosis in a valid incident report", () => {
    const diagnosis = generateMockDiagnosis("Module not found: Can't resolve './x'");
    const incident = generateIncidentReport(diagnosis, "inc_0123456789abcdef");

    expect(IncidentReportSchema.parse(incident)).toEqual(incident);
    expect(incident.incidentId).toBe("inc_0123456789abcdef");
    expect(incident.sourceType).toBe("pasted_log");
    expect(incident.status).toBe("needs_action");
    expect(incident.diagnosis).toEqual(diagnosis);
    expect(incident.investigationSteps.length).toBeGreaterThan(0);
    expect(incident.repairPlan.nextDiagnosticCommand).toBe(diagnosis.nextDiagnosticCommand);
    expect(incident.safeActions.length).toBeGreaterThan(0);
  });

  it("marks unknown incidents as needing more evidence", () => {
    const diagnosis = generateMockDiagnosis("Deployment stopped unexpectedly");
    const incident = generateIncidentReport(diagnosis, "inc_0123456789abcdef");

    expect(diagnosis.category).toBe("unknown");
    expect(incident.status).toBe("needs_more_evidence");
  });

  it("redacts evidence card quotes", () => {
    const diagnosis = {
      ...generateMockDiagnosis("Error: Missing required environment variable API_KEY"),
      evidenceLines: [
        {
          lineNumber: 1,
          text: "OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz"
        }
      ]
    };

    const incident = generateIncidentReport(diagnosis, "inc_0123456789abcdef");
    const serialized = JSON.stringify(incident.evidenceCards);

    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");
  });
});
