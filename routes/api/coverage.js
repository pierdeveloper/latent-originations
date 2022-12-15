const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const config = require('config');

// @route     GET commercial credit coverage
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.get('/commercial', [auth], async (req, res) => {
    try {
        const states = config.get('commercial_state_limits')
        res.json(states)
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})

// @route     GET consumer credit coverage
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.get('/consumer', [auth], async (req, res) => {
    try {
        const states = config.get('consumer_state_limits')
        res.json(states)
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})


module.exports = router;