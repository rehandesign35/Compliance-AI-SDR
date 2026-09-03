import "dotenv/config";
import { addToSuppressionList, normalizeComparisonValue } from "../compliance/suppressionCheck";
import { logComplianceResult } from "./logComplianceResult";

export type OptOutContact = {
  email?: string;
  phone?: string;
};

async function logOptOutEvent(contact: OptOutContact, processingTimeMs: number): Promise<any> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required for opt-out event insert.");
  }

  const contactType = contact.email ? "email" : contact.phone ? "phone" : "";
  const rawContactValue = contact.email ?? contact.phone ?? "";

  if (!contactType || !rawContactValue.trim()) {
    throw new Error("A valid email or phone value is required for opt-out event insert.");
  }

  const payload = {
    contact_value: normalizeComparisonValue(rawContactValue),
    contact_type: contactType,
    processing_time_ms: processingTimeMs,
    requested_at: new Date().toISOString()
  };

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/opt_out_events`, {
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
      `Supabase opt_out_events insert failed (${response.status} ${response.statusText}): ${errorText || "No error details returned"}`
    );
  }

  return response.json();
}

export async function handleOptOutRequest(contact: OptOutContact): Promise<{
  success: true;
  message: string;
  processedAt: string;
  processingTimeMs: number;
}> {
  const startedAt = Date.now();

  await addToSuppressionList(contact);

  const processingTimeBeforeEventLog = Date.now() - startedAt;
  await logOptOutEvent(contact, processingTimeBeforeEventLog);

  await logComplianceResult(
    {
      allowed: false,
      reason: "Contact opted out and was added to suppression list",
      checksRun: ["suppression", "optOut"],
      failedCheck: "suppression"
    },
    {
      email: contact.email,
      phone: contact.phone,
      channel: contact.email ? "email" : contact.phone ? "sms" : undefined
    }
  );

  const processedAt = new Date().toISOString();
  const processingTimeMs = Date.now() - startedAt;

  return {
    success: true,
    message: "Opt-out processed and suppression entry created.",
    processedAt,
    processingTimeMs
  };
}

export default async function handler(req: any, res: any) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const result = await handleOptOutRequest(body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown opt-out error"
    });
  }
}
