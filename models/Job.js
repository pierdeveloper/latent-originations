const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const JobSchema = new mongoose.Schema({
    errorsList: {
        type: Array,
        required: false,
        default: []
    },
    skipped: {
        type: Array,
        required: false,
        default: []
    },
    sync_count: {
        type: Number,
        required: false
    },
    facility_count: {
        type: Number,
        required: false
    },
    status: {
        type: String,
        required: true,
        enum: ['completed', 'failed']
    },
    env: {
        type: String,
        required: true,
        enum: ['production', 'sandbox', 'development', 'staging']
    },
    type: {
        type: String,
        required: true,
        enum: ['statement', 'fax']
    },
    time_initiated: {
        type: Date,
        required: false
    },
    time_completed: {
        type: Date,
        required: false
    },
    duration: {
        type: Number,
        required: false
    }
  
});

module.exports = Job = mongoose.model('job', JobSchema)