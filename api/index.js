const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { authenticate } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

const projectsRouter = require('./routes/projects');
const queuesRouter = require('./routes/queues');
const jobsRouter = require('./routes/jobs');
const scheduledJobsRouter = require('./routes/scheduledJobs');
const batchesRouter = require('./routes/batches');
const workersRouter = require('./routes/workers');
const dashboardRouter = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// All routes require authentication in this internal API
app.use(authenticate);

// Mount routers
app.use('/projects', projectsRouter);
app.use('/queues', queuesRouter);
app.use('/jobs', jobsRouter);
app.use('/scheduled-jobs', scheduledJobsRouter);
app.use('/batches', batchesRouter);
app.use('/workers', workersRouter);
app.use('/dashboard', dashboardRouter);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[API] Server listening on port ${PORT}`);
});
