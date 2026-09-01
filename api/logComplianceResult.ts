export async function logComplianceResult(
  result: {
    allowed: boolean;
    reason: string;
    checksRun?: string[];
    failedCheck?: string;
  },
  lead: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    channel?: "sms" | "voice" | "email";
  }
): Promise<any> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable for audit log insert.");
  }

  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_KEY environment variable for audit log insert.");
  }

  const payload = {
    lead_id: lead.id ?? lead.email ?? lead.phone ?? null,
    lead_name: lead.name ?? null,
    channel: lead.channel ?? "unknown",
    allowed: result.allowed,
    reason: result.reason,
    checks_run: result.checksRun ?? [],
    checked_at: new Date().toISOString()
  };

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/audit_log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase audit log insert failed (${response.status} ${response.statusText}): ${errorText || "No error details returned"}`
    );
  }

  const text = await response.text();

  if (!text || text.trim() === "") {
    return payload;
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[0];
    }
    return parsed;
  } catch (error) {
    throw new Error(`Supabase audit log insert succeeded but returned an unexpected non-JSON response: ${text}`);
  }
}
