const mongoose = require('mongoose');

const LoanAgreementSchema = new mongoose.Schema({
    status: {
        type: String,
        default: "pending_signature"
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    document_url: {
        type: String,
        required: false
    },
    id: {
        type: String,
        required: true
    },
    application_id: {
        type: String,
        required: true
    },
    accepted_offer_id: {
        type: String,
        required: false
    },
    unsigned_submission_id: {
        type: String,
        required: true
    }
});


module.exports = LoanAgreement = mongoose.model('loan_agreement', LoanAgreementSchema)