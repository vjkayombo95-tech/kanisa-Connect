# Baseline workspace

`production_schema_baseline.sql` is generated locally only after an operator explicitly confirms the production target. It is ignored by git until reviewed and deliberately converted into a versioned baseline migration.

Do not place production data, Auth users, Storage objects, credentials, or service-role keys in this directory.
