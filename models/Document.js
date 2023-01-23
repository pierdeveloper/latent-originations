const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    status: {
        type: String,
        default: "pending_signature"
    },
    client_id: {
        type: String,
        required: false
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
    signature_timestamp: {
        type: Date,
        default: null
    },
    unsigned_submission_id: {
        type: String,
        required: true
    },
    signed_submission_id: {
        type: String,
        required: false
    }
});

module.exports = Document = mongoose.model('document', DocumentSchema)