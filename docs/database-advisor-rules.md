# Database Advisor — Rule Definitions Matrix

This reference guide details the 19 core security, performance, and health rules used by the open-source InsForge Database Advisor engine.

## Security Rules (5)
* **rls-disabled:** Checks for tables missing Row Level Security completely.
* **rls-permissive:** Detects if permissive policies override explicit security layouts.
* **rls-no-policy:** Identifies tables with RLS enabled but containing no active policies (defaulting to a full block).
* **dangerous-function:** Scans for `SECURITY DEFINER` functions exposed to unauthorized public execution.
* **rls-select-only:** Flags tables lacking matching write/mutation policies.

## Performance Rules (10)
* **missing-fk-index:** Detects foreign key columns that lack matching structural indexes.
* **unused-index:** Identifies indices that occupy memory overhead but receive zero query reads.
* **slow-query:** Tracks queries exceeding a mean execution time of 1 second via `pg_stat_statements`.
* **connection-high:** Flags when connection pool consumption crosses 80% capacity.
* **connection-critical:** Flags when connection pool consumption crosses 95% capacity.
* **idle-in-transaction:** Captures client threads stalled in an uncommitted state.
* **low-cache-hit-ratio:** Monitors when shared buffer cache hit ratio drops below 95%.
* **long-running-query:** Flags individual queries executing continuously for an extended duration.
* **rls-policy-perf:** Evaluates row-level policies causing performance degradation (e.g., recursive lookups).
* **missing-rls-index:** Flags missing indices on columns frequently targeted by policy filters.

## Health Rules (4)
* **dead-tuples:** Tracks tables with excessive dead rows needing immediate vacuuming.
* **stale-statistics:** Identifies tables requiring fresh statistics analysis.
* **sequence-exhaustion:** Monitors integer sequences approaching their maximum bit allocation bounds.
* **autovacuum-blocked:** Flags system background vacuum operations being locked by active long-running client queries.