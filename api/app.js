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

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use(authenticate);

app.use('/projects', projectsRouter);
app.use('/queues', queuesRouter);
app.use('/jobs', jobsRouter);
app.use('/scheduled-jobs', scheduledJobsRouter);
app.use('/batches', batchesRouter);
app.use('/workers', workersRouter);
app.use('/dashboard', dashboardRouter);

app.use(errorHandler);

module.exports = app;
