# Form review workspace and payment-provider boundary

2026-11-21. Review UI lives exclusively in public/review. Production forms and provider integration are unchanged.

The gallery reads same-origin source HTML without invitation tokens, removes scripts/network handlers, and places only relevant sections in a sandbox with no permissions. The child CSP disallows scripts, connections, and form submission. User input exists only in the frame until navigation. No API lookup, customer prefill, checkout creation, draft storage, or real payment is performed. Native details controls and selects remain usable.

Source fields/styles are live; dynamic payment/status panels are explicitly illustrative. Family review exposes each child's inner stages directly, rather than requiring completion of the preceding child. This is not a provider or end-to-end integration test.

## Possible PayPlus move in January 2027

Planning only; no PayPlus integration enabled. New review UI uses provider-neutral payment wording. Keep the existing Grow adapter and IDs for historical recurring plans, payment confirmation, and reconciliation. Do not relabel a Grow payment as PayPlus or assume existing authorizations can be migrated.

Future adapter contract: createCheckout(requestId, amountILS, mode, installments, customerRef); verifyPayment(checkoutRef) -> provider, providerTransactionId, amountILS, currency, confirmedAt, status. Server-only verification, amount/currency/request identity matching, idempotency, signed draft recovery, family atomic completion, and manual accounting review must remain separate from the provider. Record provider alongside IDs before enabling a second provider.

Before implementation verify official PayPlus API, recurring-payment capabilities, success/notification behavior, credentials, and migration constraints. Gate any switch by explicit user decision and separate test authorization; do not create charges or payment links for this gallery.
