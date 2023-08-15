const mongoose = require('mongoose');

const ApplicationStatuses = Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
});

const LoanOfferSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    apr: {
        type: Number,
        required: false
    },
    interest_rate: {
        type: Number,
        required: false,
        default: 0
    },
    periodic_payment: {
        type: Number,
        required: false
    },
    term: {
        type: Number,
        required: true
    }
}); 


const ApplicationSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    decisioned_on: {
        type: Date,
        required: false
    },
    offers: {
        type: [LoanOfferSchema],
        required: false 
    },
    status: {
        type: String,
        enum: Object.values(ApplicationStatuses),
        required: false,
        default: "pending"
    }

});

const LoanOffer = mongoose.model('loan_offer', LoanOfferSchema);
const Application = mongoose.model('application', ApplicationSchema);

module.exports = { Application, LoanOffer };
