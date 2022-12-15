const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ApplicationSchema = new mongoose.Schema({
    application_id: {
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
    credit_type: {
        type: String,
        required: true
    },
    offer: {
        amount: {
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
        late_payment_fee: {
            type: Number,
            required: false
        },
        repayment_frequency: {
            type: String,
            required: false
        }
    },
    rejection: {
        reason: {
            type: String,
            required: false
        },
        reason_message: {
            type: String,
            required: false
        }
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