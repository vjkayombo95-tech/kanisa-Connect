# Sacramental Management

Kanisa Connect v1.2.0 introduces a Sacramental Management Platform for Catholic parish pastoral care.

## Architecture

Sacraments are managed from the Pastoral workspace:

`Pastoral Care -> Sacraments`

The module reuses:

- Workspace Framework for layout and navigation
- Member Management for parishioner linkage
- Parish Calendar Engine for scheduled sacramental events
- Automation Engine for reminders
- Kanisa AI Orchestrator for command routing
- Existing Supabase storage bucket for supporting documents
- Existing PDF tooling for printable certificates

## Data Model

The module uses one flexible table:

`public.sacramental_records`

Core fields:

- member
- church
- sacrament type
- status
- date
- minister
- location
- certificate number
- register page
- sponsors / godparents
- witnesses
- parents
- spouse
- preparation metadata
- documents
- notes

Supported sacrament types:

- Baptism
- First Holy Communion
- Confirmation
- Marriage
- Holy Orders
- Anointing of the Sick
- Funeral
- RCIA / Catechumenate

## Member Timeline

Sacramental records are linked to `members.id`. The Sacraments hub builds a member timeline from linked records, preserving the lifelong pastoral journey:

`Baptism -> Communion -> Confirmation -> Marriage / Holy Orders`

Members remain the source of truth. Sacramental records enrich the member profile rather than replacing it.

## Certificates

Printable certificate generation is available from each record.

Certificates include:

- parish name
- sacrament title
- member name
- sacrament date
- minister
- certificate number
- register page
- priest signature placeholder
- parish seal placeholder
- QR verification placeholder

Current certificate PDFs are generated client-side using the existing PDF stack.

## Calendar Integration

Scheduled sacramental records are mapped into the Parish Calendar Engine as calendar events.

Examples:

- Baptism -> baptism
- Marriage -> wedding
- Funeral -> funeral
- Confirmation / Communion / RCIA -> catechism
- Anointing -> pastoral visit

No duplicate calendar table is created. The calendar references the sacramental record.

## Automation & Notifications

The Automation Engine now has sacramental event types:

- `SACRAMENT_SCHEDULED`
- `SACRAMENT_PREPARATION_DUE`
- `SACRAMENT_CERTIFICATE_READY`

Default rules create assistant events for pastoral follow-up and certificate readiness.

## Kanisa AI

Kanisa AI can classify sacramental commands without a provider:

- "Show today's Baptisms"
- "Who has Confirmation next week?"
- "Generate Baptism certificate"
- "Which marriages are scheduled?"

These commands route to the Sacraments hub. No AI provider integration was added.

## Reports

The Sacraments hub includes summary reports:

- total records
- upcoming sacraments
- records this year
- pending certificates
- counts by sacrament type
- annual counts by sacrament type

## Document Storage

Supporting files can be attached to a record and stored in the existing `church-assets` bucket under:

`{churchId}/sacraments/{recordId-or-timestamp}/{filename}`

The stored document metadata remains on the sacramental record.

## Permissions

RLS allows:

- Pastoral, priest, church admin, secretary roles to manage records
- Members to read only their own linked sacramental history
- Super/admin church managers through existing church role management checks

## Roadmap

Future extensions:

- public QR certificate verification route
- diocesan registry sync
- dedicated member profile sacramental timeline section
- richer certificate templates per sacrament
- automated preparation class scheduling
- sacramental canonical forms
- document review workflow
