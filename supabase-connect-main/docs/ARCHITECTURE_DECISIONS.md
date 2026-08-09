# Architecture Decisions

## Why Workspace Framework Exists

The Workspace Framework keeps each role inside its own workspace while allowing pages and workflows to be reused. It prevents users from switching layouts when they click navigation and gives the product one place for shell, sidebar, header, breadcrumbs, assistant integration, and page context.

## Why Shared Providers Exist

Shared providers reduce duplicated role logic. Auth state, church context, workspace context, feature access, command center context, and query cache should be resolved once and reused by pages.

## Why Event Intelligence Exists

Event Intelligence turns existing application data into role-specific daily signals without using an AI provider. It powers assistant priorities and briefings from existing dashboard, calendar, Mass intention, prayer request, contribution, announcement, and liturgical data.

## Why Automation Engine Exists

The Automation Engine evaluates existing application events and runs configured rule actions. It is not a workflow replacement. It sits above current workflows and notifications so reminders, assistant events, and logs can be generated consistently.

## Why AI Is Provider-Independent

Kanisa AI must not send every request to a model. The orchestrator first checks intent, permissions, routes, cache, existing application logic, React Query data, and Supabase-backed workflows. Provider integrations are a future layer, not a foundation.

## Why Catholic Content Is Separated Into Datasets

Bible data, daily readings, saints, prayers, and liturgical calendar content have different sources, validation rules, editorial workflows, and import needs. Keeping them separated makes quality checks and future imports safer.

## Why Dashboards Are Role-Oriented

Parish users do not need generic statistics first. Each dashboard answers:

1. What needs my attention?
2. What should I do next?
3. What is happening today?
4. How is my parish doing?

This keeps members, priests, church admins, finance officers, and super admins focused on their real daily work.
