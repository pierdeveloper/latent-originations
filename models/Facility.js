const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const moment = require('moment');

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
    cif_number: {
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
    account_number: {
        type: String,
        required: false
    },
    nls_account_ref: {
        type: Number,
        required: false
    },
    nls_group_name: {
        type: String,
        required: false
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
    autopay_enabled: {
        type: Boolean,
        required: false
    },
    repayment_bank_details: {
        bank_account_routing: {
            type: String,
            required: false
        },
        bank_account_number: {
            type: String,
            required: false
        },
        type: {
            type: String,
            required: false,
            enum: ['checking', 'savings']
        }
    },
    balance: {
        type: Number,
        required: false
    },
    monthly_payment: {
        type: Number,
        required: false
    },
    next_payment_amount: {
        type: Number,
        required: false
    },
    current_payment_due_date: {
        type: String,
        required: false
    },
    next_payment_due_date: {
        type: String,
        required: false
    },
    last_payment_date: {
        type: String,
        required: false
    },
    principal_paid_thru: {
        type: String,
        required: false
    },
    next_billing_date: {
        type: String,
        required: false
    },
    interest_accrued_thru: {
        type: String,
        required: false
    },
    next_accrual_cutoff_date: {
        type: String,
        required: false
    },
    origination_date: {
        type: String,
        required: false
    },
    disbursement_date: {
        type: String,
        required: false
    },
    scheduled_payoff_date: {
        type: String,
        required: false
    },
    remaining_term: {
        type: Number,
        required: false
    },
    payments_due: {
        type: Array,
        required: false,
        default: []
    },
    transactions: {
        type: Array,
        required: false,
        default: []
    },
    statements: {
        type: Array,
        required: false,
        default: []
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
    },
    dwolla_customer_id: {
        type: String,
        required: false
    },
    dwolla_funding_source_id: {
        type: String,
        required: false
    }

});

module.exports = Facility = mongoose.model('facility', FacilitySchema)