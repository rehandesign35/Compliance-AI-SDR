import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { runComplianceChecks } from "../compliance/index";
import { logComplianceResult } from "../api/logComplianceResult";
import { generateOutreachCopy } from "../generation/generateCopy";
import {
  checkDeliverabilityStatus,
  recordSimulatedSendResult,
  DELIVERABILITY_CONFIG
} from "../compliance/deliverabilityMonitor";

const now = new Date("2026-09-01T16:00:00Z");
const maxContactsPerWindow = 3;
const windowDays = 30;

const projectRoot = path.resolve(__dirname, "..");
const leadsPath = path.join(projectRoot, "mock-data", "leads.json");
const suppressionListPath = path.join(projectRoot, "mock-data", "suppression-list.json");
const contactHistoryPath = path.join(projectRoot, "mock-data", "contact-history.json");

const leads = JSON.parse(fs.readFileSync(leadsPath, "utf8")) as Array<{
  id: string;
  name: string;
  email?: string;
  phone?: string;
  timezone: string;
  channel: "sms" | "voice" | "email";
  expectedOutcome: "ALLOWED" | "BLOCKED";
}>;

const suppressionList = JSON.parse(fs.readFileSync(suppressionListPath, "utf8")) as string[];
const contactHistory = JSON.parse(fs.readFileSync(contactHistoryPath, "utf8")) as Array<{
  contactId: string;
  timestamp: string;
}>;

const simulatedOutcomeOverrides: Record<string, "delivered" | "bounced" | "complained"> = {
  // Example:
  // "lead-clean-valid": "bounced"
};

function simulateAdditionalSends(channel: "email" | "sms" | "voice", outcome: "delivered" | "bounced" | "complained", count: number): void {
  for (let i = 0; i < count; i += 1) {
    recordSimulatedSendResult(channel, outcome);
  }
}

async function main() {
  // Example manual volume prep for deliverability testing:
  // simulateAdditionalSends("sms", "bounced", 5);
  // simulateAdditionalSends("email", "complained", 5);
  // The line above can be uncommented to push a channel over the minimum sample size.

  if (DELIVERABILITY_CONFIG.minSendsBeforePausing !== 5) {
    console.log(`Deliverability config override in effect: minSendsBeforePausing=${DELIVERABILITY_CONFIG.minSendsBeforePausing}`);
  }
  const results = [] as Array<{
    leadId: string;
    name: string;
    expectedOutcome: "ALLOWED" | "BLOCKED";
    actualOutcome: "ALLOWED" | "BLOCKED";
    actualReason: string;
    checksRun: string;
    match: boolean;
  }>;

  for (const lead of leads) {
    const result = runComplianceChecks(
      {
        email: lead.email,
        phone: lead.phone,
        timezone: lead.timezone
      },
      suppressionList,
      contactHistory,
      now,
      lead.channel,
      lead.id
    );

    const actualOutcome: "ALLOWED" | "BLOCKED" = result.allowed ? "ALLOWED" : "BLOCKED";

    const summary: {
      leadId: string;
      name: string;
      expectedOutcome: "ALLOWED" | "BLOCKED";
      actualOutcome: "ALLOWED" | "BLOCKED";
      actualReason: string;
      checksRun: string;
      match: boolean;
    } = {
      leadId: lead.id,
      name: lead.name,
      expectedOutcome: lead.expectedOutcome,
      actualOutcome,
      actualReason: result.reason,
      checksRun: result.checksRun.join(", "),
      match: actualOutcome === lead.expectedOutcome
    };

    results.push(summary);

    try {
      await logComplianceResult(result, lead);
    } catch (error) {
      console.warn(`Audit log write failed for ${lead.id}: ${(error as Error).message}`);
    }

    if (result.allowed) {
      const deliverabilityStatus = checkDeliverabilityStatus(lead.channel);

      if (deliverabilityStatus.paused) {
        console.log(`SEND PAUSED — deliverability threshold exceeded for ${lead.channel}: ${deliverabilityStatus.reason}`);
      } else {
        try {
          const copy = await generateOutreachCopy(lead);
          console.log(`${lead.name} — generated outreach copy:`);
          console.log(JSON.stringify(copy, null, 2));

          const simulatedOutcome = simulatedOutcomeOverrides[lead.id] ?? "delivered";
          recordSimulatedSendResult(lead.channel, simulatedOutcome);
          console.log(`${lead.name} — simulated send result: ${simulatedOutcome}`);
        } catch (error) {
          console.warn(`Copy generation failed for ${lead.name}: ${(error as Error).message}`);
        }
      }
    } else {
      console.log(`SKIPPED — copy generation not attempted (blocked by compliance)`);
    }
  }

  console.log("Compliance Evaluation Summary");
  console.table(results.map((result) => ({
    Lead: result.leadId,
    Name: result.name,
    Expected: result.expectedOutcome,
    Actual: result.actualOutcome,
    Reason: result.actualReason,
    Checks: result.checksRun,
    Match: result.match ? "YES" : "NO"
  })));

  const passed = results.filter((result) => result.match).length;
  console.log(`${passed}/6 PASSED`);
}

main().catch((error: Error) => {
  console.error("Evaluation failed:", error.message);
  process.exitCode = 1;
});
