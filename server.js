const express = require('express');
const connectDB = require('./config/db.js');
const path = require('path');

const app = express();

// connect database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

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
    // Set static folder
    app.use(express.static('client/build'));
    app.use('*', express.static('client/build')); // << this is what i'm trying to resolve ISE issues

    app.get('*', (req, res) => {
        res.sendFile(path.resove(__dirname, 'client', 'build', 'index.html'))
    });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));