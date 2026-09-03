import "dotenv/config";

type AuditRow = {
  lead_name?: string;
  channel?: string;
  allowed?: boolean;
  reason?: string;
  checked_at?: string;
};

type SuppressionRow = {
  contact_value?: string;
  contact_type?: string;
  added_at?: string;
};

type OptOutRow = {
  processing_time_ms?: number;
  created_at?: string;
};

function buildErrorResponse(res: any, statusCode: number, message: string) {
  return res.status(statusCode).json({
    ok: false,
    error: message
  });
}

async function fetchSupabase<T>(path: string): Promise<T> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be defined.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}${path}`, {
    method: "GET",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase fetch failed (${response.status} ${response.statusText}): ${body || "No response body"}`);
  }

  return (await response.json()) as T;
}

function normalizeComparableValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  return trimmed.replace(/\D+/g, "");
}

function computeComplianceAccuracy(auditEntries: AuditRow[]): number {
  if (!auditEntries.length) {
    return 0;
  }

  let correct = 0;

  for (const entry of auditEntries) {
    const reason = String(entry.reason ?? "");
    const allowed = Boolean(entry.allowed);

    const allowedPattern = /all compliance checks passed|not on suppression list/i;
    const blockedPattern = /contact is on suppression list|outside allowed contact window|frequency cap exceeded|suppression list|window|frequency/i;

    const matchesKnownRubric = (allowed && allowedPattern.test(reason)) || (!allowed && blockedPattern.test(reason));

    if (matchesKnownRubric) {
      correct += 1;
    }
  }

  return Number(((correct / auditEntries.length) * 100).toFixed(2));
}

export default async function handler(req: any, res: any) {
  try {
    const [auditRows, suppressionRows, optOutRows] = await Promise.all([
      fetchSupabase<AuditRow[]>("/rest/v1/audit_log?select=lead_name,channel,allowed,reason,checked_at&order=checked_at.desc&limit=50"),
      fetchSupabase<SuppressionRow[]>("/rest/v1/suppression_list?select=contact_value,contact_type,added_at"),
      fetchSupabase<OptOutRow[]>("/rest/v1/opt_out_events?select=processing_time_ms,created_at")
    ]);

    const totalSuppressionEntries = suppressionRows.length;
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const recentSuppressionEntries = suppressionRows.filter((row) => {
      if (!row.added_at) {
        return false;
      }

      const date = new Date(row.added_at).getTime();
      return Number.isFinite(date) && now - date <= sevenDaysMs;
    }).length;

    const totalOptOuts = optOutRows.length;
    const averageProcessingTimeMs = totalOptOuts > 0
      ? Number((optOutRows.reduce((sum, row) => sum + Number(row.processing_time_ms ?? 0), 0) / totalOptOuts).toFixed(2))
      : 0;

    const suppressionValues = suppressionRows
      .map((row) => row.contact_value)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => normalizeComparableValue(value));

    const accuracy = computeComplianceAccuracy(auditRows);

    return res.status(200).json({
      ok: true,
      auditEntries: auditRows,
      suppressionStats: {
        totalEntries: totalSuppressionEntries,
        recentAdditionsLast7Days: recentSuppressionEntries,
        values: suppressionValues
      },
      optOutStats: {
        totalOptOuts,
        averageProcessingTimeMs
      },
      complianceAccuracy: accuracy,
      deliverability: {
        note: "Deliverability monitoring is currently in-memory only and not persisted to Supabase. This dashboard shows the latest manual eval snapshot from the project docs instead of a live database-backed metric.",
        source: "manual eval run / docs/eval-results.md"
      }
    });
  } catch (error) {
    return buildErrorResponse(
      res,
      500,
      error instanceof Error ? error.message : "Unknown dashboard-data error"
    );
  }
}
