const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    client_id: {
        type: String,
        required: false
    },
    sandbox_secret: {
        type: String,
        required: false
    },
    production_secret: {
        type: String,
        required: false
    },
    production_enabled: {
        type: Boolean,
        required: true,
        default: false
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
    },
    consumer_non_zero_enabled: {
        type: Boolean,
        default: false
    }
});

module.exports = Customer = mongoose.model('customer', CustomerSchema)