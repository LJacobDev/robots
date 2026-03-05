/**
 * Global Express error handler middleware.
 *
 * Formats all unhandled errors as a consistent JSON shape and logs
 * server-side details for debugging. Stack traces are included in
 * development logs but omitted from the response in all environments.
 *
 * Expected error shape (set on thrown Error objects):
 *   err.statusCode {number} — HTTP status code (default: 500)
 *   err.code       {string} — machine-readable error code (default: 'INTERNAL_ERROR')
 *   err.message    {string} — human-readable description
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars -- Express requires 4 params to identify error middleware
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  console.error(
    `[errorHandler] ${req.method} ${req.path} → ${statusCode} ${code}: ${message}`,
    process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}
  );

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}
