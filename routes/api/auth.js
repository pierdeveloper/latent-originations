const express = require('express');
const router = express.Router();

// @route     GET api
// @desc      Test route
// @access    Public
router.get('/', async (req, res) => {
    try {
        const message = "Welcome to the desert.. of the real"
        res.json(message);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;