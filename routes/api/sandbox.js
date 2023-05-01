const express = require('express');
const auth = require('../../middleware/auth');
const config = require('config');
const router = express.Router();
const { accrueNLSLoan, syncFacilityWithNLS } = require('../../helpers/nls.js');
const { getError } = require('../../helpers/errors.js');
const { validationResult } = require('express-validator');
const { advanceDateValidationRules } = require('../../helpers/validator.js');
const Facility = require('../../models/Facility');
const responseFilters = require('../../helpers/responseFilters.json');



// @route     POST payments
// @desc      Add a payment submission
// @access    Public
router.post('/facilities/:id/advance_date', [auth, advanceDateValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // disallow in prod!
    if(process.env.NODE_ENV === 'production') {
        const error = {
            error_type: "FACILITY_ERROR",
            error_code: "UNAVAILABLE_IN_PRODUCTION",
            error_message: "This endpoint is not available in production"
        }
        return res.status(400).json(error);
    }

    // date validation
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "FACILITY_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    try {
        const client_id = req.client_id;
        const { date } = req.body

        // check that facility exists
        const facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        console.log(facility)

        // submit nls accrual
        const nlsAccrualTask = await accrueNLSLoan(facility.account_number, date);

        // check for error
        if (nlsAccrualTask === 'nls_error'){
            const error = {
                error_type: "FACILITY_ERROR",
                error_code: "ACCRUAL_FAILED",
                error_message: "The requested accrual failed"
            }
            return res.status(400).json(error);
        }

        // sync facility
        const syncJob = await syncFacilityWithNLS(facility)

        // check for errors on syncing facility
        if(syncJob !== 'SUCCESS'){
            const error = {
                error_type: "FACILITY_ERROR",
                error_code: "ACCRUAL_FAILED",
                error_message: "The requested accrual failed"
            }
            return res.status(400).json(error);
        }

        let facilityResponse = await Facility.findOne({ id: facility.id, client_id: req.client_id })
            .select(responseFilters['facility'] + ' -client_id');
        res.json(facilityResponse);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route POST /sandbox/applications/:id/set_credit_data
// @desc Set applicant's credit info
// @access Public
router.post('/applications/:id/set_credit_data', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // disallow in prod!
    if(process.env.NODE_ENV === 'production') {
        const error = {
            error_type: "FACILITY_ERROR",
            error_code: "UNAVAILABLE_IN_PRODUCTION",
            error_message: "This endpoint is not available in production"
        }
        return res.status(400).json(error);
    }

    // pull body params
    const { fico, has_bankruptcy_history } = req.body

    try {
        // pull in application
        var application = await Application.findOne({ id: req.params.id});
        // confirm application exists
        if (!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm application can be evaluated
        if(application.status !== "pending") {
            const error = getError("application_cannot_be_evaluated")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // set credit history fields if provided
        if(fico !== undefined) {
            application.credit_data.fico = fico
        }
        if(has_bankruptcy_history !== undefined) {
            application.credit_data.has_bankruptcy_history = has_bankruptcy_history
        }

        
        await application.save()

            
        // respond with application
        application = await Application.findOne({ id: req.params.id })
            .select('-_id -__v -client_id');
        
        console.log(application);
        res.json(application)
        
        
    } catch(err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

module.exports = router;