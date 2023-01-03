const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    status: {
        type: String,
        default: "PENDING_SIGNATURE"
    },
    client_id: {
        type: String,
        required: false
    },
    created_on: {
        type: Date,
        default: Date.now
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
    document_url: {
        type: String,
        required: false
    }
});

module.exports = Document = mongoose.model('document', DocumentSchema)