function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err);

  if (err.code === 'PGRST116') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Resource not found' }
    });
  }

  const statusCode = err.status || 500;
  const errorResponse = {
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
      details: err.details || null
    }
  };

  res.status(statusCode).json(errorResponse);
}

module.exports = { errorHandler };
