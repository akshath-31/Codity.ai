const express = require('express');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const { createScheduledJobSchema, updateScheduledJobSchema } = require('../validators/scheduledJobSchemas');
const cronParser = require('cron-parser');
const router = express.Router();

// GET /scheduled-jobs
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const safeLimit = Math.min(limit, 100);

    let query = supabase
      .from('scheduled_jobs')
      .select('*, queues!inner(project_id)', { count: 'exact' });

    const { data: allowedProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', req.user.organization_id);
    
    const allowedProjectIds = allowedProjects.map(p => p.id);
    if (allowedProjectIds.length === 0) {
      return res.json({ data: [], pagination: { total: 0, limit: safeLimit, offset } });
    }

    query = query.in('queues.project_id', allowedProjectIds);

    const { data, count, error } = await query
      .range(offset, offset + safeLimit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const sanitizedData = data.map(job => {
      delete job.queues;
      return job;
    });

    res.json({
      data: sanitizedData,
      pagination: { total: count, limit: safeLimit, offset }
    });
  } catch (err) {
    next(err);
  }
});

// POST /scheduled-jobs
router.post('/', validate(createScheduledJobSchema), async (req, res, next) => {
  try {
    const { queue_id, cron_expression, payload, is_active } = req.body;

    const { data: queue, error: qError } = await supabase
      .from('queues')
      .select('projects!inner(organization_id)')
      .eq('id', queue_id)
      .eq('projects.organization_id', req.user.organization_id)
      .single();

    if (qError || !queue) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid queue or access denied' } });
    }

    let next_run_at;
    try {
      const interval = cronParser.parseExpression(cron_expression, { utc: true });
      next_run_at = interval.next().toDate().toISOString();
    } catch (e) {
      return res.status(400).json({ error: { code: 'INVALID_CRON', message: e.message } });
    }

    const { data, error } = await supabase
      .from('scheduled_jobs')
      .insert({ queue_id, cron_expression, payload, is_active, next_run_at })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /scheduled-jobs/:id
router.patch('/:id', validate(updateScheduledJobSchema), async (req, res, next) => {
  try {
    const { data: job, error: fetchError } = await supabase
      .from('scheduled_jobs')
      .select('*, queues!inner(projects!inner(organization_id))')
      .eq('id', req.params.id)
      .eq('queues.projects.organization_id', req.user.organization_id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scheduled job not found' } });
    }

    const { data, error } = await supabase
      .from('scheduled_jobs')
      .update({ is_active: req.body.is_active })
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
