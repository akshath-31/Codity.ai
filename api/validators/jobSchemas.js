const { z } = require('zod');

const createJobSchema = z.object({
  queue_id: z.string().uuid(),
  job_type: z.enum(['immediate', 'delayed', 'scheduled', 'batch']),
  payload: z.any(),
  scheduled_for: z.string().datetime().optional(),
  priority: z.number().int().optional().default(0),
  max_attempts: z.number().int().min(1).optional().default(3),
}).superRefine((data, ctx) => {
  if (['delayed', 'scheduled'].includes(data.job_type) && !data.scheduled_for) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scheduled_for is required when job_type is delayed or scheduled",
      path: ["scheduled_for"],
    });
  }
});

const createBatchSchema = z.object({
  queue_id: z.string().uuid(),
  name: z.string().min(1),
  jobs: z.array(
    z.object({
      payload: z.any().optional().default({}),
      priority: z.number().int().optional().default(0),
      max_attempts: z.number().int().min(1).optional().default(3)
    })
  ).min(1)
});

module.exports = { createJobSchema, createBatchSchema };
