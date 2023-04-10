const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StatementSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    statement_date: {
        type: String,
        required: true
    },
    facility_id: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    ds_submission_id: {
        type: String,
        required: true
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    client_id: {
        type: String,
        required: true
    } 
});

module.exports = Statement = mongoose.model('statement', StatementSchema)