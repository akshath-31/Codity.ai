const express = require('express');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const { createJobSchema, createBatchSchema } = require('../validators/jobSchemas');
const router = express.Router();

// GET /jobs
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const safeLimit = Math.min(limit, 100);

    const { data: allowedProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', req.user.organization_id);
    
    const allowedProjectIds = allowedProjects.map(p => p.id);
    if (allowedProjectIds.length === 0) {
      return res.json({ data: [], meta: { total: 0, limit: safeLimit, offset } });
    }

    // Fetch allowed queues to map names and filter by project
    const { data: allowedQueues } = await supabase
      .from('queues')
      .select('id, name')
      .in('project_id', allowedProjectIds);

    const allowedQueueIds = allowedQueues.map(q => q.id);
    const queueNameMap = Object.fromEntries(allowedQueues.map(q => [q.id, q.name]));

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .in('queue_id', allowedQueueIds);

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.queue_id) query = query.eq('queue_id', req.query.queue_id);
    if (req.query.job_type) query = query.eq('job_type', req.query.job_type);

    const { data, count, error } = await query
      .range(offset, offset + safeLimit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Attach queue name to each job
    const enrichedData = data.map(job => ({
      ...job,
      queues: { name: queueNameMap[job.queue_id] || 'Unknown' }
    }));

    res.json({
      data: enrichedData,
      meta: { total: count, limit: safeLimit, offset }
    });
  } catch (err) {
    next(err);
  }
});

// GET /jobs/:id
router.get('/:id', async (req, res, next) => {
  try {
    // 1. Get allowed project IDs for the user's org
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', req.user.organization_id);
      
    const allowedProjectIds = projects.map(p => p.id);
    if (allowedProjectIds.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    // 2. Get allowed queues
    const { data: queues } = await supabase
      .from('queues')
      .select('id, name')
      .in('project_id', allowedProjectIds);
      
    const allowedQueueIds = queues.map(q => q.id);
    
    // 3. Fetch job if it belongs to an allowed queue
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        job_executions (*),
        job_logs (*)
      `)
      .eq('id', req.params.id)
      .in('queue_id', allowedQueueIds)
      .single();

    if (error) throw error;
    if (!job) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });

    // Attach queue name for frontend compatibility
    job.queues = { name: queues.find(q => q.id === job.queue_id)?.name || 'Unknown' };

    res.json(job);
  } catch (err) {
    next(err);
  }
});

// POST /jobs
router.post('/', validate(createJobSchema), async (req, res, next) => {
  try {
    const { queue_id, job_type, payload, scheduled_for, priority, max_attempts } = req.body;

    const { data: queue, error: qError } = await supabase
      .from('queues')
      .select('projects!inner(organization_id)')
      .eq('id', queue_id)
      .eq('projects.organization_id', req.user.organization_id)
      .single();

    if (qError || !queue) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid queue or access denied' } });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({ queue_id, job_type, payload, scheduled_for, priority, max_attempts })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

// POST /jobs/batch
router.post('/batch', validate(createBatchSchema), async (req, res, next) => {
  try {
    const { queue_id, name, jobs } = req.body;

    const { data: queue, error: qError } = await supabase
      .from('queues')
      .select('projects!inner(organization_id)')
      .eq('id', queue_id)
      .eq('projects.organization_id', req.user.organization_id)
      .single();

    if (qError || !queue) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid queue or access denied' } });
    }
    
    // Create batch row
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({ queue_id, name, total_jobs: jobs.length, status: 'pending' })
      .select()
      .single();
      
    if (batchError) throw batchError;

    // Map jobs with batch_id
    const jobsToInsert = jobs.map(j => ({
      queue_id,
      batch_id: batch.id,
      job_type: 'batch',
      payload: j.payload,
      priority: j.priority,
      max_attempts: j.max_attempts
    }));

    const { data: insertedJobs, error: jobsError } = await supabase
      .from('jobs')
      .insert(jobsToInsert)
      .select();

    if (jobsError) throw jobsError;
    
    // Update batch status right away since jobs start as 'queued'
    await supabase.rpc('update_batch_status', { p_batch_id: batch.id });

    res.status(201).json({ batch, jobs: insertedJobs });
  } catch (err) {
    next(err);
  }
});

// POST /jobs/:id/retry
router.post('/:id/retry', async (req, res, next) => {
  try {
    // 1. Get allowed project IDs for the user's org
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', req.user.organization_id);
      
    const allowedProjectIds = projects.map(p => p.id);
    if (allowedProjectIds.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    // 2. Get allowed queues
    const { data: queues } = await supabase
      .from('queues')
      .select('id')
      .in('project_id', allowedProjectIds);
      
    const allowedQueueIds = queues.map(q => q.id);

    // 3. Fetch job if it belongs to an allowed queue
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .in('queue_id', allowedQueueIds)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    if (!['failed', 'dead_letter'].includes(job.status)) {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Job must be in failed or dead_letter status to retry' } });
    }

    const { data: updatedJob, error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'queued',
        attempt_count: 0,
        claimed_by: null,
        claimed_at: null,
        scheduled_for: null
      })
      .eq('id', job.id)
      .select()
      .single();

    if (updateError) throw updateError;
    
    if (job.batch_id) {
      await supabase.rpc('update_batch_status', { p_batch_id: job.batch_id });
    }
    
    res.json(updatedJob);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
