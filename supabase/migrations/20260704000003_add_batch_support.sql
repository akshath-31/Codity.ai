-- 1. Create ENUM and table
CREATE TYPE batch_status AS ENUM ('pending', 'in_progress', 'completed', 'partially_failed', 'failed');

CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_jobs INT NOT NULL DEFAULT 0,
    status batch_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Modify jobs table
ALTER TABLE jobs ADD COLUMN batch_id UUID REFERENCES batches(id) ON DELETE SET NULL;
CREATE INDEX idx_jobs_batch_id ON jobs(batch_id);

-- 3. RLS Policy for batches
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access batches in their organization"
ON batches FOR ALL TO authenticated
USING (
    queue_id IN (
        SELECT id FROM queues WHERE project_id IN (
            SELECT id FROM projects WHERE organization_id IN (
                SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        )
    )
);

-- 4. RPC to compute batch status
CREATE OR REPLACE FUNCTION update_batch_status(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queued int;
  v_scheduled int;
  v_claimed int;
  v_running int;
  v_completed int;
  v_failed int;
  v_dead_letter int;
  v_total int;
  v_new_status batch_status;
BEGIN
  -- Lock batch row to avoid concurrent race conditions during fast job completions
  PERFORM id FROM batches WHERE id = p_batch_id FOR UPDATE;
  
  SELECT 
    COUNT(*) FILTER (WHERE status = 'queued'),
    COUNT(*) FILTER (WHERE status = 'scheduled'),
    COUNT(*) FILTER (WHERE status = 'claimed'),
    COUNT(*) FILTER (WHERE status = 'running'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'dead_letter'),
    COUNT(*)
  INTO
    v_queued, v_scheduled, v_claimed, v_running,
    v_completed, v_failed, v_dead_letter, v_total
  FROM jobs
  WHERE batch_id = p_batch_id;

  -- Logic exactly as requested
  IF (v_queued + v_scheduled + v_claimed + v_running) > 0 THEN
    v_new_status := 'in_progress';
  ELSIF v_completed = v_total AND v_total > 0 THEN
    v_new_status := 'completed';
  ELSIF (v_failed > 0 OR v_dead_letter > 0) AND (v_queued + v_scheduled + v_claimed + v_running) = 0 THEN
    IF v_completed = 0 THEN
      v_new_status := 'failed';
    ELSE
      v_new_status := 'partially_failed';
    END IF;
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE batches SET status = v_new_status WHERE id = p_batch_id;
END;
$$;
