const mongoose = require('mongoose');

const BorrowerSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    client_id: {
        type: String,
        required: true
    },
    created_on: {
        type: Date,
        default: Date.now
    }
});

module.exports = Borrower = mongoose.model('borrower', BorrowerSchema)