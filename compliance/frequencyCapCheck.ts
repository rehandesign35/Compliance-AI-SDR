export function checkFrequencyCap(
  contactHistory: { contactId: string; timestamp: string }[],
  contactId: string,
  maxContactsPerWindow: number,
  windowDays: number,
  now: Date
): { allowed: boolean; reason: string } {
  const cutoffTime = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const matchingContacts = contactHistory.filter((entry) => {
    if (entry.contactId !== contactId) {
      return false;
    }

    const timestamp = new Date(entry.timestamp).getTime();
    return !Number.isNaN(timestamp) && timestamp >= cutoffTime.getTime() && timestamp <= now.getTime();
  });

  if (matchingContacts.length >= maxContactsPerWindow) {
    return {
      allowed: false,
      reason: `Frequency cap exceeded: ${matchingContacts.length} contacts in last ${windowDays} days`
    };
  }

  return {
    allowed: true,
    reason: `Within frequency cap: ${matchingContacts.length} contacts in last ${windowDays} days`
  };
}
