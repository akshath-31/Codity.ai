const express = require('express');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const { createQueueSchema, updateQueueSchema } = require('../validators/queueSchemas');
const router = express.Router();

// Helper to get allowed project IDs for the user's organization
async function getAllowedProjectIds(orgId) {
  const { data } = await supabase.from('projects').select('id').eq('organization_id', orgId);
  return data ? data.map(p => p.id) : [];
}

// GET /queues - List queues
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const safeLimit = Math.min(limit, 100);

    const allowedProjectIds = await getAllowedProjectIds(req.user.organization_id);
    if (allowedProjectIds.length === 0) {
      return res.json({ data: [], pagination: { total: 0, limit: safeLimit, offset } });
    }

    const { data, count, error } = await supabase
      .from('queues')
      .select('*', { count: 'exact' })
      .in('project_id', allowedProjectIds)
      .range(offset, offset + safeLimit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      data,
      pagination: { total: count, limit: safeLimit, offset }
    });
  } catch (err) {
    next(err);
  }
});

// GET /queues/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('*, projects!inner(organization_id)')
      .eq('id', req.params.id)
      .eq('projects.organization_id', req.user.organization_id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });

    delete data.projects;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /queues/:id/stats - Job counts by status
router.get('/:id/stats', async (req, res, next) => {
  try {
    // 1. Verify access
    const { data: queue, error: qError } = await supabase
      .from('queues')
      .select('projects!inner(organization_id)')
      .eq('id', req.params.id)
      .eq('projects.organization_id', req.user.organization_id)
      .single();

    if (qError || !queue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });

    // 2. Fetch stats
    const { data, error } = await supabase.rpc('get_queue_stats', { p_queue_id: req.params.id });
    
    if (error) {
      // Fallback if RPC doesn't exist yet, we can do client side aggregation or basic counts
      const { data: jobs, error: jError } = await supabase
        .from('jobs')
        .select('status')
        .eq('queue_id', req.params.id);
        
      if (jError) throw jError;
      
      const stats = jobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {});
      
      return res.json(stats);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /queues
router.post('/', validate(createQueueSchema), async (req, res, next) => {
  try {
    // Verify project belongs to user's org
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', req.body.project_id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (pError || !project) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid project or access denied' } });
    }

    const { data, error } = await supabase
      .from('queues')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /queues/:id
router.patch('/:id', validate(updateQueueSchema), async (req, res, next) => {
  try {
    // Verify queue belongs to user's org
    const { data: queue, error: qError } = await supabase
      .from('queues')
      .select('projects!inner(organization_id)')
      .eq('id', req.params.id)
      .eq('projects.organization_id', req.user.organization_id)
      .single();

    if (qError || !queue) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });
    }

    const { data, error } = await supabase
      .from('queues')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
