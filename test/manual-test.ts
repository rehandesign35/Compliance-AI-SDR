import { runComplianceChecks } from "../compliance/index";

const tests = [
  {
    label: "TEST 1 — Suppressed lead:",
    input: {
      lead: { email: "alice@example.com", timezone: "America/New_York" },
      suppressionList: ["alice@example.com", "+1 (415) 555-0101"],
      contactHistory: [],
      now: new Date("2026-09-01T12:00:00Z"),
      channel: "sms" as const,
      contactId: "lead-1"
    },
    result: runComplianceChecks(
      { email: "alice@example.com", timezone: "America/New_York" },
      ["alice@example.com", "+1 (415) 555-0101"],
      [],
      new Date("2026-09-01T12:00:00Z"),
      "sms",
      "lead-1"
    )
  },
  {
    label: "TEST 2 — Lead outside local time window:",
    input: {
      lead: { email: "bob@example.com", timezone: "America/Los_Angeles" },
      suppressionList: [],
      contactHistory: [],
      now: new Date("2026-09-01T04:00:00Z"),
      channel: "sms" as const,
      contactId: "lead-2"
    },
    result: runComplianceChecks(
      { email: "bob@example.com", timezone: "America/Los_Angeles" },
      [],
      [],
      new Date("2026-09-01T04:00:00Z"),
      "sms",
      "lead-2"
    )
  },
  {
    label: "TEST 3 — Lead over frequency cap:",
    input: {
      lead: { email: "charlie@example.com", timezone: "UTC" },
      suppressionList: [],
      contactHistory: [
        { contactId: "lead-3", timestamp: "2026-08-15T09:00:00Z" },
        { contactId: "lead-3", timestamp: "2026-08-20T09:00:00Z" },
        { contactId: "lead-3", timestamp: "2026-08-28T09:00:00Z" }
      ],
      now: new Date("2026-09-01T12:00:00Z"),
      channel: "email" as const,
      contactId: "lead-3"
    },
    result: runComplianceChecks(
      { email: "charlie@example.com", timezone: "UTC" },
      [],
      [
        { contactId: "lead-3", timestamp: "2026-08-15T09:00:00Z" },
        { contactId: "lead-3", timestamp: "2026-08-20T09:00:00Z" },
        { contactId: "lead-3", timestamp: "2026-08-28T09:00:00Z" }
      ],
      new Date("2026-09-01T12:00:00Z"),
      "email",
      "lead-3"
    )
  },
  {
    label: "TEST 4 — Clean lead passes all checks:",
    input: {
      lead: { email: "dana@example.com", timezone: "America/New_York" },
      suppressionList: ["other@example.com"],
      contactHistory: [
        { contactId: "lead-4", timestamp: "2026-08-10T09:00:00Z" },
        { contactId: "lead-4", timestamp: "2026-08-11T09:00:00Z" }
      ],
      now: new Date("2026-09-01T12:00:00Z"),
      channel: "sms" as const,
      contactId: "lead-4"
    },
    result: runComplianceChecks(
      { email: "dana@example.com", timezone: "America/New_York" },
      ["other@example.com"],
      [
        { contactId: "lead-4", timestamp: "2026-08-10T09:00:00Z" },
        { contactId: "lead-4", timestamp: "2026-08-11T09:00:00Z" }
      ],
      new Date("2026-09-01T12:00:00Z"),
      "sms",
      "lead-4"
    )
  }
];

for (const testCase of tests) {
  console.log(testCase.label);
  console.log(JSON.stringify({ input: testCase.input, result: testCase.result }, null, 2));
  console.log("\n---\n");
}
