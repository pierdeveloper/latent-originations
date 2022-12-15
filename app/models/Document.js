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
    document_id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: "commercial_line_of_credit_agreement"
    },
    application_id: {
        type: String,
        required: true
    },
    signature_timestamp: {
        type: Date,
        required: false
    },
    document_url: {
        type: String,
        required: false
    }
});

module.exports = Document = mongoose.model('document', DocumentSchema)