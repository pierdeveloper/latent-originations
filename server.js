require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db.js');
const path = require('path');
const rateLimit = require("express-rate-limit");
const bunyan = require('bunyan');
const config = require('config');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const EventEmitter = require('events');


const app = express();

// connect database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// Init logging
const log = bunyan.createLogger({
    name: 'pier-api',
    level: config.get('logLevel')
});
app.use((req, res, next) => {
    log.info({req: req}, 'Incoming request');
    res.on('finish', () => {
        log.info({res: res}, 'Outgoing response');
    });
    next();
});

// Init rate limiting middleware
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // limit each IP to 200 requests per windowMs
    message: "Too many requests from this IP, please try again in a minute"
  });
app.use(limiter);

// Init body parser body limiter
app.use(bodyParser.json({ limit: '100kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100kb' }));

// Init helmet
app.use(helmet());

// Define Routes
app.use('/api', require('./routes/api/auth'));
app.use('/api/borrowers', require('./routes/api/borrower'));
app.use('/api/applications', require('./routes/api/application'));
app.use('/api/loan_agreements', require('./routes/api/document'));
app.use('/api/facilities', require('./routes/api/facility'));
app.use('/api/payments', require('./routes/api/payment'));
app.use('/api/coverage', require('./routes/api/coverage'));
app.use('/api/rejection_reasons', require('./routes/api/rejection_reasons'));
app.use('/api/customers', require('./routes/api/customer'));
app.use('/api/webhooks', require('./routes/api/webhook'));

const webhookEventEmitter = new EventEmitter();

// Serve static assets in production

if(process.env.NODE_ENV === 'production' /*|| process.env.NODE_ENV === 'staging'*/) {
    app.enable("trust proxy") // for express-rate-limit on heroku
    // Set static folder
    app.use(express.static('client/build'));
    app.use('*', express.static('client/build')); // << this is what i'm trying to resolve ISE issues

    app.get('*', (req, res) => {
        res.sendFile(path.resove(__dirname, 'client', 'build', 'index.html'))
    });
}

const PORT = process.env.PORT || 5001;
console.log(`environment: ${process.env}`);
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = webhookEventEmitter;