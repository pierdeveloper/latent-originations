const expressRateLimiter = require('express-rate-limit');

const limiter = expressRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hr in milliseconds
    max: 1000,
    message: 'You have exceeded the 1000 req/min rate limit', 
    standardHeaders: true,
    legacyHeaders: false
})

module.exports = limiter;