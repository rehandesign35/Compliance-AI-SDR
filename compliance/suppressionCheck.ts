import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

export function normalizeComparisonValue(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  return trimmed.replace(/\D+/g, "");
}

export function getNormalizedContactValues(contact: { email?: string; phone?: string }): string[] {
  return [contact.email, contact.phone]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeComparisonValue(value));
}

export function checkSuppressionFromList(
  contact: { email?: string; phone?: string },
  suppressionList: string[]
): { allowed: boolean; reason: string } {
  const valuesToCheck = getNormalizedContactValues(contact);
  const normalizedSuppressionList = suppressionList.map((value) => normalizeComparisonValue(value));

  for (const value of valuesToCheck) {
    if (normalizedSuppressionList.includes(value)) {
      return { allowed: false, reason: "Contact is on suppression list" };
    }
  }

  return { allowed: true, reason: "Not on suppression list" };
}

export function checkSuppression(
  contact: { email?: string; phone?: string },
  suppressionList: string[]
): { allowed: boolean; reason: string };

export function checkSuppression(
  contact: { email?: string; phone?: string }
): Promise<{ allowed: boolean; reason: string }>;

export function checkSuppression(
  contact: { email?: string; phone?: string },
  suppressionList?: string[]
): { allowed: boolean; reason: string } | Promise<{ allowed: boolean; reason: string }> {
  if (suppressionList) {
    return checkSuppressionFromList(contact, suppressionList);
  }

  return (async () => {
    try {
      const liveValues = await fetchSuppressionListFromSupabase();
      return checkSuppressionFromList(contact, liveValues);
    } catch (error) {
      const fallbackList = loadStaticSuppressionList();
      return checkSuppressionFromList(contact, fallbackList);
    }
  })();
}

export function loadStaticSuppressionList(): string[] {
  const projectRoot = path.resolve(__dirname, "..");
  const suppressionListPath = path.join(projectRoot, "mock-data", "suppression-list.json");

  if (!fs.existsSync(suppressionListPath)) {
    return [];
  }

  const raw = fs.readFileSync(suppressionListPath, "utf8");
  const parsed = JSON.parse(raw) as string[];
  return Array.isArray(parsed) ? parsed : [];
}

async function fetchSuppressionListFromSupabase(): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required to read live suppression data.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/suppression_list?select=contact_value`, {
    method: "GET",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase suppression lookup failed (${response.status} ${response.statusText}): ${errorText || "No error details returned"}`
    );
  }

  const rows = (await response.json()) as Array<{ contact_value?: string }>;
  return rows
    .map((row) => row.contact_value)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export async function addToSuppressionList(contact: { email?: string; phone?: string }): Promise<any> {
  const entries = [] as Array<{ contact_value: string; contact_type: "email" | "phone"; added_at: string }>;

  if (typeof contact.email === "string" && contact.email.trim().length > 0) {
    entries.push({
      contact_value: normalizeComparisonValue(contact.email),
      contact_type: "email",
      added_at: new Date().toISOString()
    });
  }

  if (typeof contact.phone === "string" && contact.phone.trim().length > 0) {
    entries.push({
      contact_value: normalizeComparisonValue(contact.phone),
      contact_type: "phone",
      added_at: new Date().toISOString()
    });
  }

  if (entries.length === 0) {
    throw new Error("No valid email or phone value was provided to add to the suppression list.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required to insert into the suppression list.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/suppression_list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify(entries.length === 1 ? entries[0] : entries)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase suppression insert failed (${response.status} ${response.statusText}): ${errorText || "No error details returned"}`
    );
  }

  const raw = await response.text();
  if (!raw || raw.trim() === "") {
    return { inserted: entries.length, contact_count: entries.length };
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed;
  } catch (error) {
    return { inserted: entries.length, rawResponse: raw };
  }
}
