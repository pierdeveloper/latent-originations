const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    client_id: {
        type: String,
        required: false
    },
    secret: {
        type: String,
        required: false
    },
    company_name: {
        type: String,
        required: true
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    dba_name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    }
});

module.exports = Customer = mongoose.model('customer', CustomerSchema)