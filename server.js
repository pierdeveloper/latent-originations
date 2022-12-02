const express = require('express');
const connectDB = require('./config/db.js');
const app = express();
const path = require('path');

// connect database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// Define Routes

app.use('/api', require('./routes/api/auth'));
app.use('/api/borrowers/business', require('./routes/api/business'));
app.use('/api/applications', require('./routes/api/application'));
app.use('/api/documents', require('./routes/api/document'));
/*
app.use('/app/api/auth', require('./routes/api/auth'));
app.use('/api/profile', require('./routes/api/profile'));
app.use('/api/posts', require('./routes/api/posts'));
*/

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