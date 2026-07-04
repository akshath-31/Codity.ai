const express = require('express');
const { supabase } = require('../config/supabase');
const router = express.Router();

// GET /batches/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data: batch, error } = await supabase
      .from('batches')
      .select('*, queues!inner(projects!inner(organization_id))')
      .eq('id', req.params.id)
      .eq('queues.projects.organization_id', req.user.organization_id)
      .single();

    if (error) throw error;
    if (!batch) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Batch not found' } });

    delete batch.queues;

    // Fetch counts by status
    const { data: jobs, error: jError } = await supabase
      .from('jobs')
      .select('status')
      .eq('batch_id', batch.id);

    if (jError) throw jError;

    const stats = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      ...batch,
      job_stats: stats
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
