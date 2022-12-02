const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LoanSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    application_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'application'
    },
    amount: {
        type: Number,
        required: true
    },
    billing_frequency: {
        type: String,
        required: true
    },
    initial_interest_free_period: {
        type: Number,
        required: false,
        default: 0
    },
    interest_free_period: {
        type: Number,
        required: false,
        default: 0
    },
    interest_rate: {
        type: Number,
        required: true
    },
    application_status: {
        type: String
    },
    loan_id: {
        type: mongoose.Schema.Types.ObjctId,
        ref: 'loan'
    }

});

module.exports = Loan = mongoose.model('loan', LoanSchema)