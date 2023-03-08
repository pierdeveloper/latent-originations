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
    },
    coverage_pull_count: {
        consumer: {
            type: Number,
            default: 0
        },
        commercial: {
            type: Number,
            default: 0
        }
    },
    custom_loan_agreement: {
        enabled: {
            type: Boolean,
            default: false
        },
        template_id: {
            type: String,
            required: false
        }
    },
    nls_group_name: {
        type: String,
        required: false
    }
});

module.exports = Customer = mongoose.model('customer', CustomerSchema)