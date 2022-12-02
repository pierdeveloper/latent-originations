const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    status: {
        type: String,
        default: "pending_signature"
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    doctype: {
        type: String,
        default: "loan_agreement"
    },
    application_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'application',
        required: true
    },
    date_signed: {
        type: Date,
        required: false
    },
    document_url: {
        type: String,
        required: false
    }
});

module.exports = Document = mongoose.model('document', DocumentSchema)