const { z } = require('zod');

const createScheduledJobSchema = z.object({
  queue_id: z.string().uuid(),
  cron_expression: z.string().min(5),
  payload: z.any().optional().default({}),
  is_active: z.boolean().optional().default(true)
});

const updateScheduledJobSchema = z.object({
  is_active: z.boolean()
});

module.exports = { createScheduledJobSchema, updateScheduledJobSchema };
