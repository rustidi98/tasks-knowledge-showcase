# Sanitized code

Two extracts that show the security model, which is the most interesting part of
this project. Sanitized — but the SQL and the gate logic are exactly what runs.

| File | The real problem it solves |
|---|---|
| [`rls-policy.sql`](./rls-policy.sql) | **The security boundary lives in the database, not the app.** A representative Row-Level Security policy: even if the application layer has a bug, Postgres itself won't hand a user rows they can't see. |
| [`ai-visibility-gate.ts`](./ai-visibility-gate.ts) | **A permission boundary an AI has to respect.** The app decides, per page, exactly what an external AI assistant is allowed to read — gated by a visibility flag and its own API key, with the flag cascading down the page tree. |

See [`../architecture/`](../architecture) for how the ~90 tables, ~126 migrations,
and the RLS boundary fit together.
