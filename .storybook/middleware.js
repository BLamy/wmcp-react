/**
 * Middleware for adding SharedArrayBuffer headers
 */
module.exports = function expressMiddleware(router) {
  router.use(function (req, res, next) {
    // Add COOP and COEP headers for SharedArrayBuffer support
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });
}; 