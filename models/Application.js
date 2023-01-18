const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ApplicationSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    borrower_id: {
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
    decisioned_on: {
        type: Date,
        required: false
    },
    credit_type: {
        type: String,
        required: true
    },
    offer: {
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
        finance_charge: {
            type: Number,
            required: false
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
    },
    rejection_reasons: {
        type: Array,
        required: false
    },
    requested_amount: {
        type: String,
        required: false
    },
    status: {
        type: String,
        required: false,
        default: "pending"
    }

});

module.exports = Application = mongoose.model('application', ApplicationSchema)