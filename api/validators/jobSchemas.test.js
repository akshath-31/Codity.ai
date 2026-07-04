const { createJobSchema } = require('./jobSchemas');

describe('createJobSchema', () => {
  it('rejects recurring job types', () => {
    expect(() => createJobSchema.parse({
      queue_id: '11111111-1111-1111-1111-111111111111',
      job_type: 'recurring',
      payload: {}
    })).toThrow();
  });

  it('requires scheduled_for for delayed jobs', () => {
    expect(() => createJobSchema.parse({
      queue_id: '11111111-1111-1111-1111-111111111111',
      job_type: 'delayed',
      payload: {}
    })).toThrow();
  });

  it('requires scheduled_for for scheduled jobs', () => {
    expect(() => createJobSchema.parse({
      queue_id: '11111111-1111-1111-1111-111111111111',
      job_type: 'scheduled',
      payload: {}
    })).toThrow();
  });

  it('accepts a valid immediate job without scheduled_for', () => {
    expect(() => createJobSchema.parse({
      queue_id: '123e4567-e89b-12d3-a456-426614174000',
      job_type: 'immediate',
      payload: { hello: 'world' }
    })).not.toThrow();
  });

  it('rejects a payload missing queue_id', () => {
    expect(() => createJobSchema.parse({
      job_type: 'immediate',
      payload: {}
    })).toThrow();
  });

  it('rejects a payload missing payload field', () => {
    expect(() => createJobSchema.parse({
      queue_id: '11111111-1111-1111-1111-111111111111',
      job_type: 'immediate'
    })).toThrow();
  });
});
