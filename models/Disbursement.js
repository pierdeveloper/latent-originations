const mongoose = require('mongoose');
const { BankAccountSchema } = require('./shared_schemas/BankAccount');
const Schema = mongoose.Schema;

const DisbursementSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    client_id: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: String,
        required: false
    },
    facility_id: {
        type: String,
        required: true
    },
    disbursement_bank_account: {
        type: BankAccountSchema,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'settled', 'failed', 'canceled'],
        default: 'pending'
    },
    transfer_type: {
        type: String,
        required: true,
        enum: ['standard', 'next_day', 'same_day', 'none']
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    disbursement_account: {
        type: String,
        required: true,
        enum: ['svb', 'dwolla']
    },
    dwolla_funding_source_id: {
        type: String,
        required: false
    },
    dwolla_transfer_id: {
        type: String,
        required: false
    }
});

module.exports = mongoose.model('Disbursement', DisbursementSchema);
