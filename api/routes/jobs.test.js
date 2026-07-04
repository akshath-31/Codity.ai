const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../app');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for tests');
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function makeEmail() {
  return `vitest-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('jobs routes', () => {
  let testUser;
  let testToken;
  let createdOrganizationId;
  let createdProjectId;
  let createdQueueId;
  let createdJobId;

  beforeAll(async () => {
    const email = makeEmail();
    const password = 'TestPassword123!';

    const { data: createdUser, error: createUserError } = await serviceRoleClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { test: true }
    });

    if (createUserError) throw createUserError;
    testUser = createdUser.user;

    const { data: organizationData, error: organizationError } = await serviceRoleClient.from('organizations').insert({
      name: `Vitest Org ${Date.now()}`
    }).select('id').single();

    if (organizationError) throw organizationError;
    createdOrganizationId = organizationData.id;

    const { error: profileError } = await serviceRoleClient.from('profiles').insert({
      id: testUser.id,
      organization_id: createdOrganizationId,
      email,
      role: 'owner'
    });

    if (profileError) throw profileError;

    const { data: projectData, error: projectError } = await serviceRoleClient.from('projects').insert({
      organization_id: createdOrganizationId,
      name: `Vitest Project ${Date.now()}`
    }).select('id').single();

    if (projectError) throw projectError;
    createdProjectId = projectData.id;

    const { data: queueData, error: queueError } = await serviceRoleClient.from('queues').insert({
      project_id: createdProjectId,
      name: `Vitest Queue ${Date.now()}`
    }).select('id').single();

    if (queueError) throw queueError;
    createdQueueId = queueData.id;

    const { data: jobData, error: jobError } = await serviceRoleClient.from('jobs').insert({
      queue_id: createdQueueId,
      job_type: 'immediate',
      payload: { hello: 'world' }
    }).select('id').single();

    if (jobError) throw jobError;
    createdJobId = jobData.id;

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    testToken = signInData.session.access_token;
  });

  afterAll(async () => {
    if (createdJobId) {
      await serviceRoleClient.from('jobs').delete().eq('id', createdJobId);
    }
    if (createdQueueId) {
      await serviceRoleClient.from('queues').delete().eq('id', createdQueueId);
    }
    if (createdProjectId) {
      await serviceRoleClient.from('projects').delete().eq('id', createdProjectId);
    }
    if (createdOrganizationId) {
      await serviceRoleClient.from('organizations').delete().eq('id', createdOrganizationId);
    }
    if (testUser?.id) {
      await serviceRoleClient.auth.admin.deleteUser(testUser.id);
    }
  });

  it('returns 401 for GET /jobs without an Authorization header', async () => {
    const response = await request(app).get('/jobs');
    expect(response.status).toBe(401);
  });

  it('returns 401 for GET /jobs with an invalid token', async () => {
    const response = await request(app).get('/jobs').set('Authorization', 'Bearer invalid-token');
    expect(response.status).toBe(401);
  });

  it('returns 400 for POST /jobs when queue_id is missing', async () => {
    const response = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ job_type: 'immediate', payload: {} });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with job data for GET /jobs/:id with a valid token', async () => {
    const response = await request(app)
      .get(`/jobs/${createdJobId}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(createdJobId);
    expect(response.body.queue_id).toBe(createdQueueId);
  });
});
