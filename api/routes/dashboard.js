const express = require('express');
const { supabase } = require('../config/supabase');
const router = express.Router();

// GET /dashboard/stats
router.get('/stats', async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;

    // 1. Total queues
    const { count: total_queues, error: qError } = await supabase
      .from('queues')
      .select('id, projects!inner(organization_id)', { count: 'exact', head: true })
      .eq('projects.organization_id', orgId);
    if (qError) throw qError;

    // 2. Workers online/offline (Global shared infrastructure)
    const { count: workers_online, error: woError } = await supabase
      .from('workers')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'offline');
    if (woError) throw woError;

    const { count: workers_offline, error: wfError } = await supabase
      .from('workers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'offline');
    if (wfError) throw wfError;

    // 3. Jobs completed today
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const { count: jobs_completed_today, error: jcError } = await supabase
      .from('jobs')
      .select('id, queues!inner(projects!inner(organization_id))', { count: 'exact', head: true })
      .eq('queues.projects.organization_id', orgId)
      .eq('status', 'completed')
      .gte('updated_at', startOfToday.toISOString());
    if (jcError) throw jcError;

    // 4. Jobs dead letter
    const { count: jobs_dead_letter, error: dlError } = await supabase
      .from('jobs')
      .select('id, queues!inner(projects!inner(organization_id))', { count: 'exact', head: true })
      .eq('queues.projects.organization_id', orgId)
      .eq('status', 'dead_letter');
    if (dlError) throw dlError;

    // 5. Recent Activity (last 10 jobs)
    const { data: recent_jobs, error: rjError } = await supabase
      .from('jobs')
      .select('*, queues!inner(name, projects!inner(organization_id))')
      .eq('queues.projects.organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (rjError) throw rjError;

    const cleanJobs = recent_jobs.map(job => {
      const qName = job.queues?.name;
      delete job.queues;
      return { ...job, queue_name: qName };
    });

    res.json({
      total_queues: total_queues || 0,
      workers_online: workers_online || 0,
      workers_offline: workers_offline || 0,
      jobs_completed_today: jobs_completed_today || 0,
      jobs_dead_letter: jobs_dead_letter || 0,
      recent_jobs: cleanJobs
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
