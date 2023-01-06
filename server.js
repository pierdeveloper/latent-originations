const express = require('express');
const connectDB = require('./config/db.js');
const path = require('path');
const rateLimit = require("express-rate-limit");

const app = express();

// connect database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// Init rate limiting middleware
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: "Too many requests from this IP, please try again in a minute"
  });
app.use(limiter);

// Define Routes
app.use('/api', require('./routes/api/auth'));
app.use('/api/borrowers', require('./routes/api/borrower'));
app.use('/api/applications', require('./routes/api/application'));
app.use('/api/loan_agreements', require('./routes/api/document'));
app.use('/api/coverage', require('./routes/api/coverage'));
app.use('/api/customers', require('./routes/api/customer'));
app.use('/', require('./routes/api/temp-landing'));

// Serve static assets in production

if(process.env.NODE_ENV === 'production') {
    app.enable("trust proxy") // for express-rate-limit on heroku
    // Set static folder
    app.use(express.static('client/build'));
    app.use('*', express.static('client/build')); // << this is what i'm trying to resolve ISE issues

    app.get('*', (req, res) => {
        res.sendFile(path.resove(__dirname, 'client', 'build', 'index.html'))
    });
}

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));