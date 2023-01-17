const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FacilitySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    application_id: {
        type: String,
        required: true
    },
    borrower_id: {
        type: String,
        required: true
    },
    loan_agreement_id: {
        type: String,
        required: true
    },
    client_id: {
        type: String,
        required: false
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    credit_type: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: false,
        default: "active"
    },
    terms: {
        amount: {
            type: Number,
            required: false
        },
        apr: {
            type: Number,
            required: false
        },
        annual_fee: {
            type: Number,
            required: false
        },
        billing_cycle: {
            type: Number,
            required: false
        },
        borrower_type: {
            type: String,
            required: false
        },
        fund_access: {
            type: Array,
            required: true
        },
        grace_period: {
            type: Number,
            required: false
        },
        grace_period_interest_rate: {
            type: Number,
            required: false
        },
        interest_free_period: {
            type: Number,
            required: false
        },
        interest_rate: {
            type: Number,
            required: false
        },
        interest_type: {
            type: String,
            required: true,
            default: 'fixed'
        },
        introductory_offer_interest_rate: {
            type: Number,
            required: false
        },
        introductory_offer_interest_rate_term: {
            type: Number,
            required: false
        },
        late_payment_fee: {
            type: Number,
            required: false
        },
        origination_fee: {
            type: Number,
            required: false
        },
        repayment_frequency: {
            type: String,
            required: false
        },
        term: {
            type: Number,
            required: false
        }
    }

});

module.exports = Facility = mongoose.model('facility', FacilitySchema)