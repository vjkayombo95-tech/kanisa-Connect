# Baseline verification report

Static, read-only review of `supabase/baseline/production_schema_baseline.sql`. The baseline file was not modified and no SQL was executed.

## Result

The generated baseline is an 8,742-line schema export and contains both `public` and `storage` schema definitions.

| Object type | Count | Verification |
| --- | ---: | --- |
| `CREATE TABLE` | 68 | Present |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` | 79 | Present |
| `CREATE FUNCTION` | 73 | Present |
| `CREATE TRIGGER` | 11 | Present |
| `CREATE POLICY` | 127 | Present |
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | 56 | Present |
| `public.` references | 1,068 | Present |
| `storage.` references | 140 | Present |
| `CREATE SCHEMA public` | 1 | Present |
| `CREATE SCHEMA storage` | 1 | Present |

## Interpretation

The file contains the expected structural objects for a Supabase baseline: tables, indexes, functions, triggers, RLS policies, and RLS enablement in the public schema, plus Storage schema objects.

This is a schema-only verification. It does not prove that the SQL applies cleanly to a new project, that every dependency is ordered correctly, or that Storage bucket metadata rows are included. Those checks require a separately authorized apply to an empty staging project followed by table, RPC, policy, and bucket verification.
