export function checkContactWindow(
  contact: { timezone: string },
  channel: "sms" | "voice" | "email",
  currentTimeUTC: Date
): { allowed: boolean; reason: string } {
  if (channel === "email") {
    return { allowed: true, reason: "Email has no time restriction" };
  }

  const localTime = getLocalTimeString(currentTimeUTC, contact.timezone);
  const localMinutes = getLocalMinutes(currentTimeUTC, contact.timezone);

  const allowedStartMinutes = 8 * 60;
  const allowedEndMinutes = 21 * 60;

  if (localMinutes < allowedStartMinutes || localMinutes > allowedEndMinutes) {
    return {
      allowed: false,
      reason: `Outside allowed contact window (local time: ${localTime})`
    };
  }

  return { allowed: true, reason: `Within allowed contact window (local time: ${localTime})` };
}

function getLocalTimeString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function getLocalMinutes(date: Date, timeZone: string): number {
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date);

  const hourPart = timeParts.find((part) => part.type === "hour")?.value ?? "0";
  const minutePart = timeParts.find((part) => part.type === "minute")?.value ?? "0";
  const dayPeriod = timeParts.find((part) => part.type === "dayPeriod")?.value ?? "AM";

  let hour = Number(hourPart);
  if (dayPeriod === "PM" && hour !== 12) {
    hour += 12;
  }
  if (dayPeriod === "AM" && hour === 12) {
    hour = 0;
  }

  return hour * 60 + Number(minutePart);
}
