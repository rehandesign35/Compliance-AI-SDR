| Lead | Case Type | Expected | Actual | Reason | Match |
| --- | --- | --- | --- | --- | --- |
| lead-suppressed | SUPPRESSED | BLOCKED | BLOCKED | Contact is on suppression list | Yes |
| lead-outside-window | OUTSIDE_WINDOW | BLOCKED | BLOCKED | Outside allowed contact window (local time: 2:00 AM) | Yes |
| lead-over-frequency | OVER_FREQUENCY_CAP | BLOCKED | BLOCKED | Frequency cap exceeded: 4 contacts in last 7 days | Yes |
| lead-clean-valid | CLEAN_VALID | ALLOWED | ALLOWED | All compliance checks passed | Yes |
| lead-clean-valid-sms | CLEAN_VALID_SMS | ALLOWED | ALLOWED | All compliance checks passed | Yes |
| lead-edge-suppressed-phone | EDGE_CASE | BLOCKED | BLOCKED | Contact is on suppression list | Yes |

### Test parameters
- Fixed now timestamp: 2026-09-01T16:00:00Z
- Frequency cap: maxContactsPerWindow = 3, windowDays = 30
- Runtime note: these are the current values enforced by the compliance runner in the project

6/6 compliance cases verified correct
