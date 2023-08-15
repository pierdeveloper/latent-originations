require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db.js');

const app = express();

// connect database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// Define Routes
app.use('/api/applications', require('./routes/api/application'));
app.use('/api/loan_agreements', require('./routes/api/loan_agreement'));


const PORT = process.env.PORT || 5001;
console.log(`environment: ${process.env.NODE_ENV}`);
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

