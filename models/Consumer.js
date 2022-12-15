const mongoose = require('mongoose');

const ConsumerSchema = new mongoose.Schema({
    address: {
        line_1: {
            type: String,
            required: true
        },
        line_2: {
            type: String,
            required: false
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        zip: {
            type: String,
            required: true
        },  
    },
    borrower_id: {
        type: String,
        required: true
    },
    client_id: {
        type: String,
        required: false
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    date_of_birth: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    ssn: {
        type: String,
        required: true
    },
    kyc_completion_date: {
        type: String,
        required: true
    }
});

module.exports = Consumer = mongoose.model('consumer', ConsumerSchema)