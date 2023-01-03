const mongoose = require('mongoose');

const BusinessSchema = new mongoose.Schema({
    address: {
        line_1: {
            type: String,
            required: true
        },
        line_2: {
            type: String,
            default: null
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
    beneficial_owners: [
        {
            address: {
                line_1: {
                    type: String,
                    required: true
                },
                line_2: {
                    type: String,
                    default: null
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
            }
        }
    ],
    id: {
        type: String,
        required: true
    },
    business_contact: {
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
        email: {
            type: String,
            required: true
        },
        title: {
            type: String,
            required: true
        }
    },
    business_name: {
        type: String,
        required: true
    },
    business_type: {
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
    dba_name: {
        type: String,
        required: true
    },
    ein: {
        type: String,
        required: true
    },
    incorporation_date: {
        type: String,
        required: true
    },
    kyc_completion_date: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    }
});

module.exports = Business = mongoose.model('business', BusinessSchema)