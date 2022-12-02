const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ApplicationSchema = new mongoose.Schema({
    business_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'business',
        required: true
    },
    credit_type: {
        type: String,
        required: true
    },
    creation_date: {
        type: Date,
        default: Date.now
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
    active_loan_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'loan',
        required: false
    },
    offer: {
        amount: {
            type: Number,
            required: false
        },
        interest_rate: {
            type: Number,
            required: false
        },
        repayment_frequency: {
            type: String,
            required: false
        },
        interest_free_period: {
            type: Number,
            required: false
        },
        is_revolving: {
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
        }
    }

});

module.exports = Application = mongoose.model('application', ApplicationSchema)