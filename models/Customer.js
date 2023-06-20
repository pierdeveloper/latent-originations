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
    repayment_ach_enabled: {
        type: Boolean,
        default: false,
        required: true
    },
    underwriting_enabled: {
        type: Boolean,
        default: false,
        required: true
    },
    duplicate_ssn_whitelist: {
        type: Array,
        default: []
    },
    blacklisted_states: {
        type: Array,
        default: []
    },
    nls_group_name: {
        type: String,
        required: false
    },
    statements_enabled: {
        type: Boolean,
        default: false
    }/*,
    billing: {
        start_date: {
            type: String,
            required: false
        },
        term: {
            type: Number,
            required: false
        },
        implementation_fee: {
            type: Number,
            required: false
        },
        monthly_minimums: {
            type: [MonthlyMinimumSchema],
            required: false
        },
        usage_fees: {

        }
    }*/
});
/*
const MonthlyMinimumSchema = new mongoose.Schema({
    startMonth: { type: Number, required: true },
    endMonth: { type: Number, required: true },
    amount: { type: Number, required: true }
  });

const UsageFeeSchema = new mongoose.Schema({
    product: { type: String, required: true, enum: ['origination', 'reporting', 'servicing', 'underwriting']}
})
*/
module.exports = Customer = mongoose.model('customer', CustomerSchema)