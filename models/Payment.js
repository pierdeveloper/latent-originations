const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentSchema = new mongoose.Schema({
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
        required: true
    },
    facility_id: {
        type: String,
        required: true
    },
    bank_account_number: {
        type: String,
        required: true
    },
    bank_account_routing: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'settled', 'failed'],
        default: 'pending'
    },
    transfer_type: {
        type: String,
        required: true,
        enum: ['standard', 'next_day', 'same_day', 'none']
    }
  
});

module.exports = Payment = mongoose.model('payment', PaymentSchema)