# Existing database migration

Back up MongoDB before any production migration. Start MongoDB, configure `MONGODB_URI`, then run the read-only audit:

```bash
npm --prefix backend run audit-profiles
```

The JSON report identifies users and profiles missing `hospitalId`, role/profile mismatches, missing Patient/Doctor/Nurse/Receptionist profiles, and orphan profiles. When exactly one hospital exists, the apply mode can safely assign legacy records to it and can create unambiguous Patient, Nurse, and Receptionist profiles:

```bash
npm --prefix backend run repair-profiles
```

Apply mode does not delete profiles or medical data. A Doctor without a profile is reported but not fabricated because specialization/licensing data requires an administrator decision. Resolve such rows through Admin → User Management after assigning the account to the hospital. Re-run the audit until the report contains no unresolved critical inconsistency.

For a database with no Hospital record, run `npm --prefix backend run create-admin` first. For a genuinely multi-hospital legacy database, do not use automatic assignment: map each record to the correct Hospital in a reviewed migration because ownership cannot be inferred safely.
