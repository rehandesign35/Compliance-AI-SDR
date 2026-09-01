export const DELIVERABILITY_CONFIG = {
  bounceRateThreshold: 5,
  complaintRateThreshold: 5,
  minSendsBeforePausing: 5
};

type Channel = "email" | "sms" | "voice";
type Outcome = "delivered" | "bounced" | "complained";

type ChannelStats = {
  totalSends: number;
  bounces: number;
  complaints: number;
};

const channelStats: Record<Channel, ChannelStats> = {
  email: { totalSends: 0, bounces: 0, complaints: 0 },
  sms: { totalSends: 0, bounces: 0, complaints: 0 },
  voice: { totalSends: 0, bounces: 0, complaints: 0 }
};

export function recordSimulatedSendResult(channel: Channel, outcome: Outcome): void {
  const stats = channelStats[channel];
  stats.totalSends += 1;

  if (outcome === "bounced") {
    stats.bounces += 1;
  }

  if (outcome === "complained") {
    stats.complaints += 1;
  }
}

export function checkDeliverabilityStatus(channel: Channel): {
  paused: boolean;
  reason: string;
  bounceRate: number;
  complaintRate: number;
} {
  const stats = channelStats[channel];
  const totalSends = stats.totalSends;

  if (totalSends < DELIVERABILITY_CONFIG.minSendsBeforePausing) {
    return {
      paused: false,
      reason: `Sample size too small for ${channel} (${totalSends} sends)`,
      bounceRate: totalSends === 0 ? 0 : (stats.bounces / totalSends) * 100,
      complaintRate: totalSends === 0 ? 0 : (stats.complaints / totalSends) * 100
    };
  }

  const bounceRate = (stats.bounces / totalSends) * 100;
  const complaintRate = (stats.complaints / totalSends) * 100;

  if (bounceRate > DELIVERABILITY_CONFIG.bounceRateThreshold) {
    return {
      paused: true,
      reason: `Bounce rate ${bounceRate.toFixed(2)}% exceeds threshold ${DELIVERABILITY_CONFIG.bounceRateThreshold}%`,
      bounceRate,
      complaintRate
    };
  }

  if (complaintRate > DELIVERABILITY_CONFIG.complaintRateThreshold) {
    return {
      paused: true,
      reason: `Complaint rate ${complaintRate.toFixed(2)}% exceeds threshold ${DELIVERABILITY_CONFIG.complaintRateThreshold}%`,
      bounceRate,
      complaintRate
    };
  }

  return {
    paused: false,
    reason: `Deliverability healthy for ${channel}: bounce ${bounceRate.toFixed(2)}%, complaint ${complaintRate.toFixed(2)}%`,
    bounceRate,
    complaintRate
  };
}
