const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const config = require('config');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Application = require('../../models/Application');
const { validationResult } = require('express-validator');
const { applicationValidationRules, 
        offerValidationRules,
        rejectionValidationRules } = require('../../helpers/validator.js');

// @route     POST application
// @desc      Create a credit application
// @access    Public
router.post('/', [auth, applicationValidationRules()], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "invalid_input",
            error_code: "invalid_input",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    try {
        const client_id = req.client_id;
        const { borrower_id, credit_type  } = req.body

        // check that borrower exists
        let borrower = await Borrower.findOne({ id: borrower_id })
        if(!borrower || borrower.client_id !== req.client_id) {
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const application_id = 'app_' + uuidv4().replace(/-/g, '');
        let application = new Application({
            application_id,
            borrower_id,
            client_id,
            credit_type
        })
        
        await application.save()

        application = await Application.findOne({ application_id })
            .select('-_id -__v -client_id');
        res.json(application);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});

// @route PATCH applications/reject
// @desc Reject credit application
// @access Public
router.patch('/:id/reject', [auth, rejectionValidationRules()], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "invalid_input",
            error_code: "invalid_input",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    const rejection_reason = req.body.rejection_reason

    const rejectionFields = {}
    rejectionFields.reason = rejection_reason
    rejectionFields.reason_message = config.rejection_reasons.get(rejection_reason)

    try {
        let application = await Application.findOne({ application_id: req.params.id });
        if(!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        if(application.status !== "pending") {
            const error = getError("application_cannot_be_approved")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        application.rejection = rejectionFields
        application.status = 'rejected'
        await application.save()
        application = await Application.findOne({ application_id: req.params.id })
            .select('-_id -__v -client_id');
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

// @route PATCH application
// @desc Approve credit application
// @access Public
router.patch('/:id/approve', [auth, offerValidationRules()], async (req, res) => {

    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "invalid_input",
            error_code: "invalid_input",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    const { offer } = req.body

    const offerFields = {};
    offerFields.amount = offer.amount,
    offerFields.interest_rate = offer.interest_rate,
    offerFields.repayment_frequency = offer.repayment_frequency,
    offerFields.interest_free_period = offer.interest_free_period,
    offerFields.is_revolving = offer.is_revolving,
    offerFields.late_payment_fee = offer.late_payment_fee

    try {
        let application = await Application.findOne({ application_id: req.params.id});
        if (!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        if(application.status !== "pending") {
            const error = getError("application_cannot_be_approved")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // grab borrower
        let borrower = await Borrower.findOne({ id: application.borrower_id })
        if(!borrower || borrower.client_id !== req.client_id) {
            console.log('borrower not found');
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // if it's business then
        if(borrower.type === 'business') {
            let business = await Business.findOne({ borrower_id: application.borrower_id })
            //verify state is supported (ie it's not PR, guam etc)
            if(!(business.address.state in config.commercial_state_limits)) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } 

            // verify Pier has limits for the state
            if(Object.keys(config.commercial_state_limits.get(business.address.state)).length === 0) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
            
            // verify if either type 1 or type 2 supports the offer
            const type_1 = config.commercial_state_limits.get(business.address.state).type_1
            const type_2 = config.commercial_state_limits.get(business.address.state).type_2

            //type 1
            if ((offer.amount >= type_1.amount.min && 
                offer.amount <= type_1.amount.max &&
                offer.interest_rate <= type_1.max_apr &&
                type_1.supported_business_types.includes(business.business_type)) ||
                // type 2
                (
                    offer.amount >= type_2?.amount.min &&
                    offer.amount <= type_2?.amount.max &&
                    offer.interest_rate <= type_2?.max_apr &&
                    type_2?.supported_business_types.includes(business.business_type)
                )) {
                    // accept approval if offer meets type 1 or type 2
                    application.offer = offerFields
                    application.status = 'approved'
                    await application.save()

                    application = await Application.findOne({ application_id: req.params.id })
                        .select('-_id -__v -client_id');
                    
                    res.json(application)
                } else {
                    // otherwise reject
                    const error = getError("unsupported_offer_terms")
                    return res.status(error.error_status).json({ 
                        error_type: error.error_type,
                        error_code: error.error_code,
                        error_message: error.error_message
                    })
                }
        } else {
            // if it's consumer then
            let consumer = await Consumer.findOne({ borrower_id: application.borrower_id })
            //verify state is supported (ie it's not PR, guam etc)
            if(!(consumer.address.state in config.consumer_state_limits)) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } 

            // verify Pier has limits for the state
            if(Object.keys(config.consumer_state_limits.get(consumer.address.state)).length === 0) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
            
            // verify if either type 1 or type 2 supports the offer
            const type_1 = config.consumer_state_limits.get(consumer.address.state).type_1

            //type 1
            if ((offer.amount >= type_1.amount.min && 
                offer.amount <= type_1.amount.max &&
                offer.interest_rate <= type_1.max_apr )) {
                    // accept approval if offer meets type 1
                    application.offer = offerFields
                    application.status = 'approved'
                    await application.save()
                    application = await Application.findOne({ application_id: req.params.id })
                        .select('-_id -__v -client_id');
                    res.json(application)
                } else {
                    // otherwise reject
                    const error = getError("unsupported_offer_terms")
                    return res.status(error.error_status).json({ 
                        error_type: error.error_type,
                        error_code: error.error_code,
                        error_message: error.error_message
                    })
                }
        }
        
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


// @route     GET application by id
// @desc      Retrieve an application's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    try {
        const application = await Application.findOne({ application_id: req.params.id })
            .select('-_id -__v');
            console.log(application)
        if(!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        application.client_id = undefined;
        res.json(application);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_application_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET applications
// @desc      List all applications
// @access    Public
router.get('/', [auth], async (req, res) => {
    try {
        const applications = await Application.find({ client_id: req.client_id })
            .select('-_id -__v -client_id');
        res.json(applications);
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