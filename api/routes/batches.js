const express = require('express');
const { supabase } = require('../config/supabase');
const router = express.Router();

// Helper to get allowed queue IDs for the user's organization
async function getAllowedQueueIds(orgId) {
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('organization_id', orgId);
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map(p => p.id);
  const { data: queues } = await supabase
    .from('queues')
    .select('id')
    .in('project_id', projectIds);
  return queues ? queues.map(q => q.id) : [];
}

// GET /batches - list all batches for the org
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const safeLimit = Math.min(limit, 100);

    const allowedQueueIds = await getAllowedQueueIds(req.user.organization_id);
    if (allowedQueueIds.length === 0) {
      return res.json({ data: [], meta: { total: 0, limit: safeLimit, offset } });
    }

    const { data: batches, count, error } = await supabase
      .from('batches')
      .select('*', { count: 'exact' })
      .in('queue_id', allowedQueueIds)
      .range(offset, offset + safeLimit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch job status counts for all batches in a single query
    const batchIds = batches.map(b => b.id);
    const { data: jobs } = await supabase
      .from('jobs')
      .select('batch_id, status')
      .in('batch_id', batchIds);

    // Build a job_stats map keyed by batch_id
    const statsMap = {};
    for (const job of (jobs || [])) {
      if (!statsMap[job.batch_id]) statsMap[job.batch_id] = {};
      statsMap[job.batch_id][job.status] = (statsMap[job.batch_id][job.status] || 0) + 1;
    }

    const enriched = batches.map(b => ({ ...b, job_stats: statsMap[b.id] || {} }));

    res.json({ data: enriched, meta: { total: count, limit: safeLimit, offset } });
  } catch (err) {
    next(err);
  }
});

// GET /batches/:id
router.get('/:id', async (req, res, next) => {
  try {
    const allowedQueueIds = await getAllowedQueueIds(req.user.organization_id);
    if (allowedQueueIds.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Batch not found' } });
    }

    const { data: batch, error } = await supabase
      .from('batches')
      .select('*')
      .eq('id', req.params.id)
      .in('queue_id', allowedQueueIds)
      .single();

    if (error) throw error;
    if (!batch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Batch not found' } });

    // Fetch job status stats
    const { data: jobs, error: jError } = await supabase
      .from('jobs')
      .select('id, job_type, status, priority, attempt_count, created_at, queue_id')
      .eq('batch_id', batch.id);

    if (jError) throw jError;

    const stats = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    res.json({ ...batch, job_stats: stats, jobs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
