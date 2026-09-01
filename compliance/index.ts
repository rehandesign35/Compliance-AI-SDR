import { checkSuppression } from "./suppressionCheck";
import { checkContactWindow } from "./contactWindowCheck";
import { checkFrequencyCap } from "./frequencyCapCheck";

export function runComplianceChecks(
  lead: {
    email?: string;
    phone?: string;
    timezone: string;
  },
  suppressionList: string[],
  contactHistory: { contactId: string; timestamp: string }[],
  now: Date,
  channel: "sms" | "voice" | "email" = "sms",
  contactId = lead.email || lead.phone || "lead"
): { allowed: boolean; reason: string; checksRun: string[]; failedCheck?: string } {
  const checksRun: string[] = [];

  const suppressionResult = checkSuppression(lead, suppressionList);
  checksRun.push("suppression");
  if (!suppressionResult.allowed) {
    return {
      allowed: false,
      reason: suppressionResult.reason,
      checksRun,
      failedCheck: "suppression"
    };
  }

  const windowResult = checkContactWindow(lead, channel, now);
  checksRun.push("contactWindow");
  if (!windowResult.allowed) {
    return {
      allowed: false,
      reason: windowResult.reason,
      checksRun,
      failedCheck: "contactWindow"
    };
  }

  const frequencyResult = checkFrequencyCap(contactHistory, contactId, 3, 30, now);
  checksRun.push("frequencyCap");
  if (!frequencyResult.allowed) {
    return {
      allowed: false,
      reason: frequencyResult.reason,
      checksRun,
      failedCheck: "frequencyCap"
    };
  }

  return {
    allowed: true,
    reason: "All compliance checks passed",
    checksRun
  };
}
