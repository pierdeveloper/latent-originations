const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const { getError } = require('../../helpers/errors.js');


// @route     GET rejection reasons
// @desc      Retrieve list of acceptable rejection reasons for consumer credit
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)
    
    try {
        const rejection_reasons = require('../../helpers/rejectionReasons.json');
        res.json(rejection_reasons);
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