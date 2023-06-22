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
        type: {
            type: String,
            enum: ['loan', 'revolving_line_of_credit'],
            required: false
        },
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
            type: Schema.Types.Mixed,
            required: false
        },
        first_payment_date: {
            type: String,
            required: false
        },
        repayment_frequency: { // deprecated
            type: String,
            required: false
        },
        payment_period: {
            type: String,
            required: false
        },
        periodic_payment: {
            type: Number,
            required: false
        },
        term: {
            type: Number,
            required: false
        },
        third_party_disbursement_destination: {
            type: String,
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
    },
    third_party_disbursement_destination: {
        type: String,
        required: false
    }, 
    credit_data: {
        fico: {
            type: Number,
            required: false
        },
        has_bankruptcy_history: {
            type: Boolean,
            required: false
        }
    }

});

const OriginationFeeSchema = new mongoose.Schema({
    fee: {
        type: Number,
        required: false
    },
    fee_type: {
        type: String,
        enum: ['fixed', 'percentage'],
        required: false
    },
})

module.exports = Application = mongoose.model('application', ApplicationSchema)