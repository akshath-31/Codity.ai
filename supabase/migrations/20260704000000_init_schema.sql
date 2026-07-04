-- Create ENUMs
CREATE TYPE retry_strategy AS ENUM ('fixed', 'linear', 'exponential');
CREATE TYPE job_type AS ENUM ('immediate', 'delayed', 'scheduled', 'recurring', 'batch');
CREATE TYPE job_status AS ENUM ('queued', 'scheduled', 'claimed', 'running', 'completed', 'failed', 'dead_letter');
CREATE TYPE execution_status AS ENUM ('running', 'succeeded', 'failed');
CREATE TYPE worker_status AS ENUM ('idle', 'busy', 'offline');
CREATE TYPE log_level AS ENUM ('info', 'warn', 'error');

-- 1. organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. retry_policies
CREATE TABLE retry_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    strategy retry_strategy NOT NULL,
    base_delay_seconds INT NOT NULL,
    max_retries INT NOT NULL,
    max_delay_seconds INT NOT NULL
);

-- 4. queues
CREATE TABLE queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    concurrency_limit INT NOT NULL DEFAULT 10,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    retry_policy_id UUID REFERENCES retry_policies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. workers
-- (Created without FK to jobs first to handle mutual dependency)
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status worker_status NOT NULL DEFAULT 'offline',
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_job_id UUID
);

-- 6. jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    job_type job_type NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status job_status NOT NULL DEFAULT 'queued',
    priority INT NOT NULL DEFAULT 0,
    scheduled_for TIMESTAMPTZ,
    claimed_by UUID REFERENCES workers(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add mutual FK from workers to jobs
ALTER TABLE workers ADD CONSTRAINT fk_current_job FOREIGN KEY (current_job_id) REFERENCES jobs(id) ON DELETE SET NULL;

-- 7. job_executions
CREATE TABLE job_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE SET NULL,
    attempt_number INT NOT NULL,
    status execution_status NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    error_message TEXT,
    result JSONB
);

-- 8. scheduled_jobs
CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    cron_expression TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. worker_heartbeats
CREATE TABLE worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE SET NULL,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cpu_usage FLOAT,
    memory_usage FLOAT
);

-- 11. job_logs
CREATE TABLE job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    execution_id UUID REFERENCES job_executions(id) ON DELETE SET NULL,
    log_level log_level NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. dead_letter_queue
CREATE TABLE dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    failure_reason TEXT NOT NULL,
    attempt_count INT NOT NULL,
    moved_to_dlq_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_queue_id ON jobs(queue_id);
CREATE INDEX idx_jobs_scheduled_for ON jobs(scheduled_for);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_workers_status ON workers(status);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE retry_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
