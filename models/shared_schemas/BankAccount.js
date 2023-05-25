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

module.exports = BankAccountSchema;