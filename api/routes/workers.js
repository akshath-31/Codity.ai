const express = require('express');
const { supabase } = require('../config/supabase');
const router = express.Router();

// GET /workers - List workers
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const safeLimit = Math.min(limit, 100);

    const { data, count, error } = await supabase
      .from('workers')
      .select('*', { count: 'exact' })
      .eq('organization_id', req.user.organization_id)
      .range(offset, offset + safeLimit - 1)
      .order('last_heartbeat_at', { ascending: false });

    if (error) throw error;

    res.json({
      data,
      pagination: { total: count, limit: safeLimit, offset }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
