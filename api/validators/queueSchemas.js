const { z } = require('zod');

const createQueueSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
  priority: z.number().int().optional().default(0),
  concurrency_limit: z.number().int().min(1).optional().default(10),
  is_paused: z.boolean().optional().default(false),
  retry_policy_id: z.string().uuid().nullable().optional()
});

const updateQueueSchema = z.object({
  priority: z.number().int().optional(),
  concurrency_limit: z.number().int().min(1).optional(),
  is_paused: z.boolean().optional(),
  retry_policy_id: z.string().uuid().nullable().optional()
});

module.exports = { createQueueSchema, updateQueueSchema };
