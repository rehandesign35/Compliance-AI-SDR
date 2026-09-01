import { addToSuppressionList } from "../compliance/suppressionCheck";
import { logComplianceResult } from "./logComplianceResult";

export type OptOutContact = {
  email?: string;
  phone?: string;
};

export async function handleOptOutRequest(contact: OptOutContact): Promise<{
  success: true;
  message: string;
  processedAt: string;
  processingTimeMs: number;
}> {
  const startedAt = Date.now();

  await addToSuppressionList(contact);

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
  ).catch((error) => {
    console.warn(`Opt-out audit log write failed: ${(error as Error).message}`);
  });

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
