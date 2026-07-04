CREATE OR REPLACE FUNCTION claim_next_job(p_worker_id UUID, p_queue_ids UUID[])
RETURNS SETOF jobs
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_job jobs;
    v_queue queues;
    v_running_count INT;
BEGIN
    -- 1. Select the candidate job with row locking
    -- We use FOR UPDATE OF j SKIP LOCKED to only lock the jobs table row.
    -- We do NOT evaluate the concurrency_limit here to avoid race conditions.
    SELECT j.* INTO v_job
    FROM jobs j
    JOIN queues q ON j.queue_id = q.id
    WHERE j.queue_id = ANY(p_queue_ids)
      AND (j.status = 'queued' OR (j.status = 'scheduled' AND j.scheduled_for <= now()))
      AND q.is_paused = false
    ORDER BY j.priority DESC, j.created_at ASC
    LIMIT 1
    FOR UPDATE OF j SKIP LOCKED;
    
    -- 2. If a candidate job was found, we proceed to check capacity
    IF FOUND THEN
        -- Acquire a transaction-scoped advisory lock on the specific queue.
        -- This guarantees that only one worker can check/update this queue's capacity at a time.
        PERFORM pg_advisory_xact_lock(hashtext(v_job.queue_id::text));
        
        -- 3. Check the concurrency limits while holding the advisory lock
        SELECT * INTO v_queue FROM queues WHERE id = v_job.queue_id;
        
        SELECT count(*) INTO v_running_count
        FROM jobs
        WHERE queue_id = v_job.queue_id
          AND status IN ('claimed', 'running');
          
        -- If queue is at or above capacity, abort the claim.
        -- We return nothing, and the advisory/row locks are released naturally.
        IF v_running_count >= v_queue.concurrency_limit THEN
            RETURN;
        END IF;

        -- 4. Proceed with claim since capacity is available
        UPDATE jobs
        SET status = 'claimed',
            claimed_by = p_worker_id,
            claimed_at = now(),
            updated_at = now()
        WHERE id = v_job.id
        RETURNING * INTO v_job;

        UPDATE workers
        SET status = 'busy',
            current_job_id = v_job.id
        WHERE id = p_worker_id;

        -- Return the single updated row
        RETURN NEXT v_job;
    END IF;
    
    -- Return empty if no job is eligible
    RETURN;
END;
$$;
