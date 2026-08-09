# Unified Church Financial Reporting

RC-2.9.3 adds a reporting projection for verified church income. It does not create a new payment system and does not reclassify event fees as contributions.

## Architecture Audit

Kanisa Connect currently receives church money through source-specific workflows:

- `contributions`: recorded giving, offerings, and contribution receipts.
- `pledge_payments`: payment evidence against pledge promises.
- `event_registration_payments`: paid event registration evidence from RC-2.9.0.
- `mass_intentions`: pastoral request records. Current portal submission also records the offering in `contributions`, so mass intention rows are not counted separately in the unified projection.
- `platform_fees`: platform fee tracking, not church-retained income.

There is no single canonical income ledger table that safely covers all source types. The smallest safe architecture is therefore a server-side reporting projection over existing verified source rows.

## Canonical Financial Model

The model is:

Financial source -> source-specific business record -> verified source payment/transaction -> unified reporting projection.

The projection is exposed by:

`public.get_church_financial_summary(_church_id uuid, _start_date date default null, _end_date date default null)`

It returns:

- `total_received`
- `this_month_received`
- `transaction_count`
- `contribution_total`
- `pledge_payment_total`
- `event_registration_total`
- source-specific monthly totals and counts

## Included Sources

Contributions are counted from `contributions.amount`.

Pledge payments are counted from `pledge_payments.amount` only when `verification_status = 'approved'`. A pledge promise is not received income.

Event registration revenue is counted from `event_registration_payments.amount` only when `status = 'approved'`.

## Excluded Sources

Pending, submitted, rejected, failed, cancelled, and unverified payment evidence is excluded.

Mass intention offerings are excluded as a direct source because the current portal RPC records accepted mass intention offerings in `contributions`. Counting both would double-count.

Platform fees are excluded from church income totals.

## Double-Counting Prevention

Each source is counted once:

- Contribution: the `contributions` row is the financial source.
- Pledge payment: the approved `pledge_payments` row is the financial source, not the pledge promise.
- Event registration: the approved `event_registration_payments` row is the financial source, not the event, attendance row, or member registration.
- Mass intention: current money flow is already represented by a contribution row.

## Event Payment Integration

`review_event_registration_payment` changes `event_registration_payments.status` to `approved` and updates the attendance payment state to paid. The reporting RPC reads the approved payment state directly, so no frontend insert or duplicate contribution is required.

## Server-Side Aggregation

Financial totals are calculated in the database. The dashboard does not load all financial rows into the browser for aggregate calculations.

## Authorization

The summary RPC requires one of:

- `can_manage_church_workspace`
- `can_manage_church_roles`
- platform super admin
- super admin

Members do not receive parish-wide financial totals. Member giving history remains member-specific.

## Receipts

Receipts stay source-specific:

- Contribution receipts remain contribution receipts.
- Event registration receipts remain event registration receipts.
- Pledge payment receipts follow pledge payment behavior.

Unified reporting does not merge receipt labels.

## Refunds and Reversals

Event registration payments with `status = 'refunded'` are not counted. Automated negative reversal accounting is not yet implemented. If retained-income reversal history is needed later, add a source-specific reversal model before including refunded amounts.

## Kanisa AI

Member financial answers remain scoped to member-visible contribution history. Church Admin and Finance workspace answers may use the unified summary only where existing workspace authorization allows parish-wide financial visibility.

## Localization

Dashboard labels use:

- English: Total Received, Income, Transactions, Contributions, Pledge Payments, Event Registration Revenue.
- Kiswahili: Jumla Iliyopokelewa, Mapato, Miamala, Michango, Malipo ya Ahadi, Mapato ya Usajili wa Matukio.

Currency formatting continues to use the existing TZS helpers.

## Known Limitations

The projection is a reporting aggregate, not a posted accounting ledger. It intentionally avoids duplicating money records. If future audit requirements require immutable ledger entries, introduce them with idempotent source references and migration backfill rules.
