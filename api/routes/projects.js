const express = require('express');
const { supabase } = require('../config/supabase');
const { validate } = require('../middleware/validate');
const { createProjectSchema } = require('../validators/projectSchemas');
const router = express.Router();

// GET /projects - List projects with pagination
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const safeLimit = Math.min(limit, 100);

    const { data, count, error } = await supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('organization_id', req.user.organization_id)
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

// GET /projects/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /projects
router.post('/', validate(createProjectSchema), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    const { data, error } = await supabase
      .from('projects')
      .insert({
        organization_id: req.user.organization_id,
        name,
        description
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
