const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');

// @route     GET commercial credit coverage
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.get('/commercial', [auth], async (req, res) => {
    try {
        const states = commercial_state_limits;
        res.json(states);
    } catch(err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET consumer credit coverage
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.get('/consumer', [auth], async (req, res) => {
    try {
        const states = consumer_state_limits;
        res.json(states);
    } catch(err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})


module.exports = router;