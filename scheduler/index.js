require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const cronParser = require('cron-parser');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
let loopInterval = null;

async function checkScheduledJobs() {
  try {
    const now = new Date().toISOString();
    
    // 1. Fetch due jobs
    const { data: dueJobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now);

    if (error) throw error;
    if (!dueJobs || dueJobs.length === 0) return;

    // 2. Process each job independently
    for (const sJob of dueJobs) {
      try {
        // a. Insert the spawned job
        const { data: insertedJob, error: insertError } = await supabase
          .from('jobs')
          .insert({
            queue_id: sJob.queue_id,
            job_type: 'recurring',
            payload: sJob.payload,
            status: 'queued',
            max_attempts: 3, // Default fallback
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // b. Calculate next run time
        const interval = cronParser.parseExpression(sJob.cron_expression);
        const nextRun = interval.next().toDate().toISOString();

        // c. Update the scheduled_jobs row
        const { error: updateError } = await supabase
          .from('scheduled_jobs')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun
          })
          .eq('id', sJob.id);

        if (updateError) throw updateError;

        console.log(`[Scheduler] Spawned job ${insertedJob.id} from schedule ${sJob.id}. Next run: ${nextRun}`);

      } catch (err) {
        // Log row-level error without breaking the loop
        console.error(`[Scheduler] Failed to process scheduled job ${sJob.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[Scheduler] Global loop error:`, err);
  }
}

// 3. Startup and execution
async function startScheduler() {
  console.log('[Scheduler] Starting up...');
  
  // Log active schedules count on startup
  const { count } = await supabase
    .from('scheduled_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
    
  console.log(`[Scheduler] Found ${count || 0} active scheduled jobs.`);
  console.log('[Scheduler] Initiating 30-second polling loop.');

  loopInterval = setInterval(checkScheduledJobs, 30000);
  checkScheduledJobs(); // Run immediately on startup
}

// 4. Graceful shutdown
function shutdown() {
  console.log('\n[Scheduler] Shutting down.');
  if (loopInterval) clearInterval(loopInterval);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startScheduler();
