const mongoose = require('mongoose');

const RuleSchema = new mongoose.Schema({
    property: {
        type: String,
        required: true,
        enum: ['fico', 'has_bankruptcy_history']

    },
    operator: {
        type: String,
        required: true,
        enum: ['greater_than', 'less_than', 'equal_to']
    },
    value: {
        type: mongoose.Schema.Types.Mixed, 
        required: true
    }
})
/*
const OfferLimitSchema = new mongoose.Schema({
    max_amount: {
        type: Number,
        required: false
    },
    max_term: {
        type: Number,
        required: false
    },
    min_interest_rate: {
        type: Number,
        required: false
    }
})
*/
/*
const RulesetSchema = new mongoose.Schema({
    id: {
        type: String,
        required: false
    },
    credit_policy_id: {
        type: String,
        required: false
    },
    rules: {
        type: [RuleSchema],
        default: []
    },
    offer_terms: {
        type: OfferLimitSchema,
        default: {}
    }
})
*/
const CreditPolicySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    client_id: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['drafted', 'pending_approval', 'approved', 'deployed'],
        default: 'drafted'
    },
    rules: {
        type: [RuleSchema],
        default: []
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    last_updated: {
        type: Date,
        default: Date.now
    },
    changelog: {
        type: Array,
        default: []
    }
});



module.exports = { 
    CreditPolicy: mongoose.model('credit_policy', CreditPolicySchema),
    //Ruleset: mongoose.model('ruleset', RulesetSchema),
    Rule: mongoose.model('rule', RuleSchema)
    //OfferLimit: mongoose.model('offer_limit', OfferLimitSchema)
}