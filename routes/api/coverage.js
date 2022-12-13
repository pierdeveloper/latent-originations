const express = require('express');
const router = express.Router();
const config = require('config');

// @route     GET commercial credit coverage
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.get('/commercial', async (req, res) => {
    const states = config.get('states')
    console.log(states)
    res.json(states)
    
})


module.exports = router;