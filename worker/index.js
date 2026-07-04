require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); // Assuming .env is at the root
const { createClient } = require('@supabase/supabase-js');
const os = require('os');
const { calculateBackoff } = require('./utils');
const { executeJob } = require('./jobHandler');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const organizationId = process.env.WORKER_ORGANIZATION_ID;
const queueIdsRaw = process.env.WORKER_QUEUE_IDS || '';

if (!supabaseUrl || !supabaseKey || !organizationId || !queueIdsRaw) {
  console.error('[Worker] Missing required environment variables.');
  process.exit(1);
}

const queueIds = queueIdsRaw.split(',').map(id => id.trim());
const supabase = createClient(supabaseUrl, supabaseKey);

let workerId = null;
let isShuttingDown = false;
let currentJobId = null;
let currentExecutionId = null;
let pollTimeout = null;
let heartbeatInterval = null;

async function startWorker() {
  console.log('[Worker] Starting up...');
  
  const workerName = `worker-${os.hostname()}-${process.pid}`;

  const { data: worker, error } = await supabase.from('workers').insert({
    name: workerName,
    organization_id: organizationId,
    status: 'idle',
    started_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString()
  }).select('id').single();

  if (error) {
    console.error('[Worker] Failed to register worker:', error);
    process.exit(1);
  }

  workerId = worker.id;
  console.log(`[Worker] Registered with ID: ${workerId}`);

  startHeartbeat();
  pollForJobs();
}

function startHeartbeat() {
  heartbeatInterval = setInterval(async () => {
    if (isShuttingDown) return;
    try {
      const now = new Date().toISOString();
      await supabase.from('workers').update({ last_heartbeat_at: now }).eq('id', workerId);
      await supabase.from('worker_heartbeats').insert({ worker_id: workerId, heartbeat_at: now });
    } catch (err) {
      console.error('[Worker] Heartbeat error:', err);
    }
  }, 10000); // 10 seconds
}

async function logJob(job_id, execution_id, level, message) {
  try {
    await supabase.from('job_logs').insert({
      job_id,
      execution_id,
      log_level: level,
      message
    });
  } catch (err) {
    console.error(`[Worker] Failed to log: ${message}`, err);
  }
}

async function pollForJobs() {
  if (isShuttingDown) return;

  try {
    // 1. Claim next job via RPC
    const { data: jobs, error } = await supabase.rpc('claim_next_job', {
      p_worker_id: workerId,
      p_queue_ids: queueIds,
    });

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      pollTimeout = setTimeout(pollForJobs, 2000);
      return;
    }

    const job = jobs[0];
    currentJobId = job.id;
    console.log(`[Worker] Claimed job ${job.id}`);

    // 2. Insert Execution Record
    let { data: execution, error: execError } = await supabase.from('job_executions').insert({
      job_id: job.id,
      worker_id: workerId,
      attempt_number: job.attempt_count + 1,
      status: 'running',
    }).select().single();

    if (execError) throw execError;
    currentExecutionId = execution.id;

    // 3. Update job status to 'running'
    await supabase.from('jobs').update({ status: 'running' }).eq('id', job.id);

    try {
      // 4. Execute the Job
      const result = await executeJob(job);

      // 5. Success Flow
      await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
      await supabase.from('job_executions').update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        result: result
      }).eq('id', execution.id);

      await logJob(job.id, execution.id, 'info', 'Job completed successfully');

    } catch (err) {
      // 6. Failure Flow
      console.error(`[Worker] Job ${job.id} failed:`, err);
      const newAttemptCount = job.attempt_count + 1;

      await supabase.from('job_executions').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: err.message
      }).eq('id', execution.id);

      if (newAttemptCount < job.max_attempts) {
        // Retry logic
        const { data: queue } = await supabase.from('queues').select('retry_policy_id').eq('id', job.queue_id).single();
        let delaySeconds = 60;
        
        if (queue && queue.retry_policy_id) {
          const { data: policy } = await supabase.from('retry_policies').select('*').eq('id', queue.retry_policy_id).single();
          if (policy) {
            delaySeconds = calculateBackoff(policy, newAttemptCount);
          }
        }
        
        const nextRun = new Date(Date.now() + delaySeconds * 1000).toISOString();

        await supabase.from('jobs').update({
          status: 'scheduled',
          scheduled_for: nextRun,
          attempt_count: newAttemptCount,
          claimed_by: null,
          claimed_at: null
        }).eq('id', job.id);
        
        await logJob(job.id, execution.id, 'warn', `Job failed, retrying at ${nextRun}`);
      } else {
        // Dead Letter Queue
        await supabase.from('dead_letter_queue').insert({
          original_job_id: job.id,
          queue_id: job.queue_id,
          payload: job.payload,
          failure_reason: err.message,
          attempt_count: newAttemptCount
        });

        await supabase.from('jobs').update({
          status: 'dead_letter',
          attempt_count: newAttemptCount,
          claimed_by: null,
          claimed_at: null
        }).eq('id', job.id);
        
        await logJob(job.id, execution.id, 'error', 'Job failed permanently, moved to DLQ');
      }
    }

    // 7. Update batch status if part of a batch
    if (job.batch_id) {
      try {
        await supabase.rpc('update_batch_status', { p_batch_id: job.batch_id });
      } catch (err) {
        console.error(`[Worker] Failed to update batch status for batch ${job.batch_id}:`, err);
      }
    }

  } catch (error) {
    console.error(`[Worker] Polling error:`, error);
  } finally {
    currentJobId = null;
    currentExecutionId = null;
    if (!isShuttingDown) {
      await supabase.from('workers').update({ status: 'idle', current_job_id: null }).eq('id', workerId);
      pollTimeout = setTimeout(pollForJobs, 2000);
    }
  }
}

async function gracefulShutdown(signal) {
  console.log(`\n[Worker] Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;
  
  if (pollTimeout) clearTimeout(pollTimeout);
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  if (currentJobId) {
    console.log(`[Worker] Waiting up to 30s for current job (ID: ${currentJobId}) to finish...`);
    
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 30000));
    
    let checkInterval;
    const completionPromise = new Promise(resolve => {
      checkInterval = setInterval(() => {
        if (!currentJobId) {
          resolve('completed');
        }
      }, 500);
    });

    const result = await Promise.race([completionPromise, timeoutPromise]);
    clearInterval(checkInterval);

    if (result === 'timeout') {
      console.log(`[Worker] Job ${currentJobId} timed out during shutdown. Releasing back to queue...`);
      await supabase.from('jobs').update({
        status: 'queued',
        claimed_by: null,
        claimed_at: null
      }).eq('id', currentJobId);
      
      if (currentExecutionId) {
        await supabase.from('job_executions').update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: 'Worker shut down before completion'
        }).eq('id', currentExecutionId);
      }
    } else {
      console.log(`[Worker] Current job finished cleanly.`);
    }
  }

  console.log(`[Worker] Setting status to offline and exiting.`);
  if (workerId) {
    await supabase.from('workers').update({
      status: 'offline',
      current_job_id: null
    }).eq('id', workerId);
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startWorker();
