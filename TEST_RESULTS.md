# Test Results Documentation

This is a living document that records all manual and automated testing performed on this project.

## Component: Database RPC & Schema

### 1. `claim_next_job` RPC — Concurrency & Atomicity Test
**Date/Time:** 2026-07-04
**Setup/Steps:** 
- Seeded database with 2 queues (one active with `concurrency_limit = 2`, one paused).
- Seeded 5 sample jobs in the active queue with varying priorities.
- Called `claim_next_job` manually 3 times in a row to simulate 3 concurrent workers.
**Expected Result:**
- First two calls claim the highest priority eligible jobs.
- Third call returns `null` (respecting `concurrency_limit = 2`).
- No jobs claimed from the paused queue.
**Actual Result:** 
- Jobs were strictly claimed in priority order. 
- The third worker call correctly returned no job because the queue's running count hit the cap. Paused queue was completely ignored.
**Status:** ✅ Pass

---

## Component: Worker Service

### 2. Worker Service — Test A (Happy Path)
**Date/Time:** 2026-07-04
**Setup/Steps:**
- Seeded 2 normal jobs (`testA_1` and `testA_2`).
- Started `npm start` on the worker with a 3-5s artificial delay in `executeJob()`.
**Expected Result:** 
- Worker claims both jobs sequentially, transitions them from `queued` → `claimed` → `running` → `completed`.
- Execution rows and log rows generated.
**Actual Result:** 
- Console output verified successful processing.
- DB verified `job_executions` rows (`succeeded` status) and `job_logs` rows (`info` log_level) were created correctly.
**Status:** ✅ Pass

### 3. Worker Service — Test B (Retry + Backoff)
**Date/Time:** 2026-07-04
**Setup/Steps:**
- Created a `fixed` retry policy with 1s delay and attached to queue.
- Seeded a job with `{"forceFail": true}` payload and `max_attempts = 3`.
- Tracked timestamp difference between execution cycles.
**Expected Result:** 
- The worker fails the job 3 times, incrementing `attempt_count`.
- `scheduled_for` is exactly 1 second after `finished_at` for each retry.
**Actual Result:** 
- `attempt_count` updated accurately: `1 → 2 → 3`.
- Timestamps verified:
  - Attempt 1 finished: `07:30:44.894` → `scheduled_for`: `07:30:45.894`
  - Attempt 2 finished: `07:30:47.400` → `scheduled_for`: `07:30:48.400`
  - Attempt 3 finished: `07:30:49.843`
**Status:** ✅ Pass

### 4. Worker Service — Test C (Dead Letter Queue)
**Date/Time:** 2026-07-04
**Setup/Steps:**
- Following directly from Test B, observe behavior after 3 failed attempts.
**Expected Result:**
- Job status updates to `dead_letter`.
- A row is inserted into `dead_letter_queue` mapping back to the `original_job_id`.
**Actual Result:**
- Job ID `f5d46e58-33b3-46a1-8f71-162d0369a0e0` moved correctly to DLQ.
- `failure_reason` accurately logged as: *"Simulated failure due to forceFail payload"*.
**Status:** ✅ Pass

### 5. Worker Service — Test D (Graceful Shutdown)
**Date/Time:** 2026-07-04
**Setup/Steps:**
- Seeded 1 normal job.
- Added a `setTimeout` script to send a simulated `SIGINT` mid-execution.
**Expected Result:**
- Worker traps the signal, delays exit for up to 30s to allow the current job to finish, marks it cleanly, and sets itself offline.
**Actual Result:**
- Logged: `[Worker] Received SIMULATED_SIGINT. Starting graceful shutdown...`
- Logged: `[Worker] Waiting up to 30s for current job...`
- Job finished successfully. Worker marked status as `offline` and exited `0`.
**Status:** ✅ Pass

---

## Component: Scheduler Service

### 6. Scheduler Service — Recurring Cron Test
**Date/Time:** 2026-07-04
**Setup/Steps:**
- Seeded 1 `scheduled_jobs` row with cron expression `*/1 * * * *` (every minute).
- Started the scheduler and let it poll every 30s for over 2 minutes.
**Expected Result:**
- 3 jobs spawned into `jobs` table exactly 1 minute apart.
- The `scheduled_jobs.next_run_at` is pushed out correctly each time.
- No backlog replay (doesn't spawn hundreds of missed jobs instantly).
**Actual Result:**
- 3 recurring jobs spawned at exactly:
  - `08:27:15.474`
  - `08:28:15.447`
  - `08:29:15.667`
- `scheduled_jobs.next_run_at` updated properly to `08:30:00+00`.
- Only generated the correct 3 intervals in real-time.
**Status:** ✅ Pass

---

## Component: Batch Job Processing

### 7. Batch Job Processing — Mixed Success/Failure Test
**Date/Time:** 2026-07-04
**Setup/Steps:**
- Seeded a `batches` row (`name: 'test_batch_1'`, `total_jobs: 5`).
- Inserted 5 jobs mapping to `batch_id`: 3 normal, 2 with `forceFail` (max_attempts: 1).
- Ran the worker to process the entire queue seamlessly.
**Expected Result:**
- The 3 normal jobs execute successfully (`completed`).
- The 2 failing jobs skip retries and go straight to DLQ (`dead_letter`).
- The batch state progressively updates on every iteration.
- The final state evaluates to `partially_failed` natively via the Postgres RPC lock.
**Actual Result:**
- `batches` row final state verified: `status = partially_failed`.
- `jobs` verified: 3x `completed`, 2x `dead_letter`.
**Status:** ✅ Pass

---

## Pending Tests
The following areas are still untested and planned for future implementation/validation:
- **REST API endpoint tests:** Verifying correct endpoints for submitting/managing jobs.
- **Batch job tests:** Spawning, tracking, and completing jobs submitted in parallel batches.
- **Frontend/Dashboard tests:** Confirming UI visibility of jobs and metrics.
- **RLS cross-organization isolation test:** Confirming Organization A truly cannot read/write Organization B's queues, jobs, and workers.
- **Load/Stress testing:** Proving throughput and database stability under heavy queue pressure.

## Internal REST API

### Test 8: E2E API Verification
**Date/Time**: 2026-07-04
**Setup/Steps**:
1. Started Express server locally (
ode index.js).
2. Logged in as 	estuser2@example.com to acquire a valid Supabase JWT.
3. Ran a suite of HTTP requests against the endpoints using the real token.

**Expected Result**:
- Valid authenticated requests return properly scoped data (with correct relational depth, like nested executions for jobs).
- Missing token returns 401.
- Attempting to access resources outside the organization (or a fake UUID) returns 404 (due to our explicit application-level isolation).
- Batch job endpoint properly injects default validation values (priority = 0) before inserting.

**Actual Result**:
- GET /projects: Returned 200 with the single test project.
- GET /jobs: Returned 200 with 2 test jobs scoped perfectly.
- GET /jobs/:id: Returned 200 with job_executions and job_logs correctly nested.
- POST /jobs/batch: Returned 201; automatically set default priority and created batch + members safely.
- No-auth request: Returned 401 {"error":{"code":"UNAUTHORIZED","message":"Missing or invalid Authorization header"}}.
- Fake UUID request: Returned 404 {"error":{"code":"NOT_FOUND","message":"Resource not found"}}.

**Status**: Pass

### Test 9: Strict Cross-Tenant Isolation
**Date/Time**: 2026-07-04
**Setup/Steps**:
1. Seeded a brand new Organization ("Rival Corp"), Project, Queue, and Job directly into the database.
2. Verified the ID of the rival job (e.g., e26824b-...).
3. Used the original user's JWT (	estuser2@example.com belonging to Org 17f6dbd6-...) to attempt a GET /jobs/:id for the rival's job ID.

**Expected Result**:
- The API should block access and return 404 Not Found, despite the fact that the job ID *does* physically exist in the database, proving that the relational .eq('queues.projects.organization_id', req.user.organization_id) filter correctly drops rows across tenant boundaries.

**Actual Result**:
- The request returned 404 Not Found (PGRST116: The result contains 0 rows). The data never left the database.

**Status**: Pass
