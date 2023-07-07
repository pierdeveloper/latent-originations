const mongoose = require('mongoose');

const BankAccountSchema = new mongoose.Schema({
    bank_routing_number: {
        type: String,
        required: false
    },
    bank_account_number: {
        type: String,
        required: false
    },
    type: {
        type: String,
        enum: ['checking', 'savings'],
        required: false
    }
}, { _id: false });

const AutopaySchema = new mongoose.Schema({
    authorized: {
        type: Boolean,
        required: false
    },
    bank_account: {
        type: BankAccountSchema,
        required: false
    },
    authorization_timestamp: {
        type: Date,
        required: false
    },
    additional_amount: {
        type: Number,
        required: false
    }
}, { _id: false });


module.exports = {BankAccountSchema, AutopaySchema};