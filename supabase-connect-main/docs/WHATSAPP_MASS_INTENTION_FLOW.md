# WhatsApp “Nia ya Misa” flow

This Phase 1 flow is deterministic; it does not use generative AI. Commands work in every state: `MENU`, `RUDI`, `ANZA UPYA`, `GHAIRI`, and `MSAADA`.

| State | Accepted input | Exact response / next state |
|---|---|---|
| `IDLE` | Entry phrase or `MENU` | “Karibu Nia ya Misa. Chagua aina:\n1. Marehemu\n2. Shukrani\n3. Uponyaji\n4. Nia maalum” → `SELECT_INTENTION_TYPE` |
| `SELECT_INTENTION_TYPE` | 1–4 or type word | “Andika maelezo mafupi ya nia yako.” → `ENTER_INTENTION_DETAILS` |
| `ENTER_INTENTION_DETAILS` | At least 3 characters | “Andika tarehe ya Misa (YYYY-MM-DD).” → `SELECT_DATE` |
| `SELECT_DATE` | Valid, non-past ISO date | “Chagua namba ya muda wa Misa uliopo.” → `SELECT_MASS_TIME` |
| `SELECT_MASS_TIME` | Available slot | “Thibitisha: {aina}; {maelezo}; {tarehe}; {Misa}. Jibu NDIYO au HAPANA.” → `CONFIRM_SUMMARY` |
| `CONFIRM_SUMMARY` | `NDIYO` | “Ombi limehifadhiwa. Tumia kiungo salama cha malipo utakachotumiwa.” → `AWAITING_PAYMENT` |
| `AWAITING_PAYMENT` | Verified provider callback | Confirmation or manual-review notice → `COMPLETED` only after verification |
| `COMPLETED` | Entry phrase | Starts a new flow |
| `CANCELLED` | `MENU` / restart | Starts a new flow |

Error messages are: “Sijaelewa…” for an invalid type, “Tarehe si sahihi au imepita…” for dates, and “Misa hiyo haipatikani au imejaa…” for slots. `GHAIRI` replies “Ombi limeghairiwa. Andika MENU kuanza tena.” `MSAADA` explains the global commands.

Payment is deliberately callback-driven. Browser redirects never set `payment_status = 'paid'`. Capacity must be locked and checked by the future provider callback adapter; duplicate, unverified, unavailable, and manual-approval cases stay in manual review.
