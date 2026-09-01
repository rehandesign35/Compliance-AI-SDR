# Project 6 — Compliance-Aware AI SDR

## The problem

Outbound compliance is a legal minefield for US-facing outreach. TCPA governs calls and texts. CAN-SPAM governs email. Do Not Call registries and opt-outs have to be honored permanently, not per campaign. Most "AI SDR" projects skip all of this and focus entirely on personalized message generation — the easy, overdone part.

This project proves the opposite priority: the compliance engine comes first, generation is a secondary layer on top of it. Anyone can prompt an LLM to write a cold email. Very few outbound demos show a suppression list that's actually checked before every send, a contact-window rule that's actually enforced, or an opt-out that actually works immediately. That gap is the entire point of this build.

**A note on how this was demoed:** no real unsolicited outreach was sent to real people. Actually cold-contacting strangers to prove an "AI SDR" works would recreate the exact compliance problem this project claims to solve. Instead, the compliance decision engine is proven against a mock lead dataset with deliberately varied cases, and the opt-out flow is tested self-directed — a visitor opts out their own information on demand, the same consent pattern already used in Project 1's inbound-call design.

## Architecture

```
Mock lead dataset (deliberately varied compliance cases)
        │
        ▼
Compliance middleware  ──── runs BEFORE any outreach attempt:
        │                     - suppression list check
        │                     - contact-window check (channel + timezone)
        │                     - frequency cap check
        ▼
   [blocked] ──→ logged with reason, never sent
   [allowed] ──→ LLM-generated personalized copy → simulated send
        │
        ▼
Supabase  ──── full audit log: every attempt, every check run, every result
        │
        ▼
Deliverability monitoring (simulated bounce/complaint tracking, pauses sends
                            on threshold breach)
        │
        ▼
Dashboard  ──── compliance decisions, audit log, suppression list stats,
                self-service opt-out test
```

## The compliance proof

This is the section that matters most. Everything below is pulled directly from the actual eval run and live Supabase data — not asserted.

### Mock dataset results

Six leads were run through the compliance engine, covering: a suppressed contact, a contact outside their allowed window, a contact over the frequency cap, a clean valid case per channel, and an edge case testing phone-number normalization against the suppression list.

| Lead | Case Type | Expected | Actual | Reason | Match |
|---|---|---|---|---|---|
| `[FILL IN]` | Suppressed | Blocked | `[FILL IN]` | `[FILL IN]` | `[FILL IN]` |
| `[FILL IN]` | Outside contact window | Blocked | `[FILL IN]` | `[FILL IN]` | `[FILL IN]` |
| `[FILL IN]` | Over frequency cap | Blocked | `[FILL IN]` | `[FILL IN]` | `[FILL IN]` |
| `[FILL IN]` | Clean (email) | Allowed | `[FILL IN]` | `[FILL IN]` | `[FILL IN]` |
| `[FILL IN]` | Clean (SMS, in-window) | Allowed | `[FILL IN]` | `[FILL IN]` | `[FILL IN]` |
| `[FILL IN]` | Suppressed, differently formatted | Blocked | `[FILL IN]` | `[FILL IN]` | `[FILL IN]` |

**Result: `[X]/6` compliance cases verified correct.** Full detail in [`docs/eval-results.md`](./docs/eval-results.md).

### Opt-out proof

A visitor can opt out their own contact info and immediately see a subsequent contact attempt against that same info get blocked.

- Contact opted out: `[FILL IN — e.g. "test email, self-submitted"]`
- Opt-out processing time: `[FILL IN] ms`
- Re-check against the same contact immediately after: **blocked**, reason: `[FILL IN]`

This proves the suppression list is live and enforced in real time, not a static file checked once at build time.

### Deliverability pause proof

The deliverability monitor was tested by deliberately pushing a channel's simulated bounce rate past its threshold.

- Channel tested: `[FILL IN]`
- Simulated sends: `[FILL IN]`, bounces: `[FILL IN]`
- Computed bounce rate: `[FILL IN]%` (threshold: 5%)
- Result: sending paused — `[FILL IN — confirm actual log message]`

**Threshold note:** the complaint-rate threshold used in this demo is set at a demo-appropriate percentage rather than a production-realistic one (~0.1%, typical for real ESPs). At mock-dataset volume (single-digit sends), a production threshold would trigger on a single complaint regardless, making it untestable in any meaningful way. The threshold is config-driven (`DELIVERABILITY_CONFIG` in `/compliance/deliverabilityMonitor.ts`) specifically so it can be tuned to realistic values once real send volume exists.

## Tech stack

- **Compliance logic + audit log:** Supabase — suppression list, audit log, and opt-out events all persisted and queried live via REST API (same HTTP Request pattern used across every project in this portfolio, for portability across environments)
- **Generation:** OpenAI gpt-4o-mini, for personalized outreach copy — intentionally the secondary layer, only invoked after a lead clears every compliance check
- **Channels:** code is structured as if wired to Twilio (SMS/voice) and an ESP like Resend/SendGrid (email); the public demo simulates sends rather than dispatching to real third parties
- **Dashboard:** static page + serverless functions on Vercel, same pattern as prior projects

## Known limitations

- No real outreach was sent to real people. Suppression, contact-window, and frequency-cap logic is proven against a mock dataset and self-directed opt-out testing — not live third-party sends. This was a deliberate constraint, not a shortcut: sending real unsolicited outreach to prove an anti-spam tool works would be the exact problem the project exists to prevent.
- The complaint-rate threshold is set at a demo-scale value, not a production-realistic one, for the reason explained above. It is config-driven and intended to be tightened once real send volume justifies it.
- Deliverability stats shown on the dashboard are `[FILL IN — state whether persisted to Supabase via a snapshot table, or shown as a static result from a manual eval run, per whichever option was chosen in Step 8]`.

## How this connects to the rest of the portfolio

Project 1 (Sam) already built TCPA-aware calling-hours logic and immediate opt-out handling — for one channel. This project generalizes that same discipline into an architecture that spans every outbound channel, rather than leaving it as a single feature buried inside one agent.

Sam proved compliance could be built into one channel. This is what it looks like as the actual foundation, not an afterthought.

## Live links

- Dashboard: `[FILL IN]`
- GitHub repo: `[FILL IN]`

## Repo structure

```
/README.md              → this file
/compliance/             → suppression list, contact-window, frequency-cap logic
/mock-data/              → the deliberately varied lead dataset used for the demo
/generation/             → LLM-based personalized copy (secondary layer)
/api/                    → audit logging + opt-out endpoint
/dashboard/               → compliance decisions, audit log, opt-out test UI
/docs/eval-results.md    → compliance-check accuracy across the mock dataset
```
