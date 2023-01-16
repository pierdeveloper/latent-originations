const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Application = require('../../models/Application');
const Facility = require('../../models/Facility');
const { validationResult } = require('express-validator');
const { applicationValidationRules, 
        offerValidationRules,
        rejectionValidationRules } = require('../../helpers/validator.js');
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const valid_rejection_reasons = require('../../helpers/rejectionReasons.json');

// @route     POST facility
// @desc      Create a credit facility
// @access    Public
router.post('/', [auth], async (req, res) => {
    const client_id = req.client_id
    const { loan_agreement_id } = req.body

    // validate input TODO!
    /*
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "BORROWER_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }*/
    try {
        // pull up the loan agreement
        let loan_agreement = await Document.findOne({ id: loan_agreement_id });

        // verify it exists
        if(!loan_agreement || loan_agreement.client_id !== client_id) {
            const error = getError("document_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Confirm a facility for th is loan agreement does not already exist
        let existingFacility = await Facility
            .findOne({ loan_agreement_id: loan_agreement.id });
        if(existingFacility) {
            const error = getError("document_not_found")
            console.log('need to update this error. Existing facility found')
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm loan_agreement status is SIGNED
        if(loan_agreement.status !== 'SIGNED') {
            const error = getError("document_cannot_be_signed")
            console.log('need to udpate this error. Loan agreement status must be signed')
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Pull up relevant application
        let application = await Application.findOne({ id: loan_agreement.application_id })

        // Pull up relevant borrower
        const borrower = await Borrower.findOne({ id: application.borrower_id })

        // build facility params
        const application_id = application.id;
        const borrower_id = borrower.id;
        let credit_type = "";
        if(application.credit_type === 'LOAN') {
            credit_type = "installment"
        } else {
            credit_type = "line_of_credit"
        }


        // Create facilty and save
        const facility_id = 'fac_' + uuidv4().replace(/-/g, '');
        let facility = new Facility({
            id: facility_id,
            application_id,
            borrower_id,
            loan_agreement_id,
            client_id,
            credit_type,
            terms: application.offer
        })
        await facility.save()

        // Response
        facility = await Facility.findOne({ id: facility_id, client_id })
            .select('-_id -__v -client_id');
        res.json(facility);
        
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
router.post('/:id/reject', [auth, rejectionValidationRules()], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "APPLICATION_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    const rejection_reason = req.body.rejection_reason

    const rejectionFields = {}
    rejectionFields.reason = rejection_reason
    rejectionFields.reason_message = valid_rejection_reasons[rejection_reason]

    try {
        let application = await Application.findOne({ id: req.params.id });
        if(!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        if(application.status !== "PENDING") {
            const error = getError("application_cannot_be_rejected")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        application.rejection = rejectionFields
        application.status = 'REJECTED'
        application.decisioned_on = Date.now();
        await application.save()
        application = await Application.findOne({ id: req.params.id })
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
router.post('/:id/approve', [auth, offerValidationRules()], async (req, res) => {
    // validate offer params
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "APPLICATION_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    const { offer } = req.body

    // build offer object
    const offerFields = {};
    offerFields.amount = offer.amount;
    offerFields.apr = offer.apr;
    offerFields.interest_rate = offer.interest_rate;
    offerFields.late_payment_fee = offer.late_payment_fee;
    offerFields.grace_period = offer.grace_period;
    offerFields.origination_fee = offer.origination_fee;
    offerFields.term = offer.term;

    if(offer.hasOwnProperty("annual_fee")) {
        offerFields.annual_fee = offer.annual_fee
    }
    if(offer.hasOwnProperty("billing_cycle")) {
        offerFields.billing_cycle = offer.billing_cycle
    }
    if(offer.hasOwnProperty("grace_period_interest_rate")) {
        offerFields.grace_period_interest_rate = offer.grace_period_interest_rate
    } else {
        offerFields.grace_period_interest_rate = 0 // default value
    }
    if(offer.hasOwnProperty("introductory_offer_interest_rate")) {
        offerFields.introductory_offer_interest_rate = offer.introductory_offer_interest_rate
    }
    if(offer.hasOwnProperty("introductory_offer_interest_rate_term")) {
        offerFields.introductory_offer_interest_rate_term = offer.introductory_offer_interest_rate_term
    }
    if(offer.hasOwnProperty("repayment_frequency")) {
        offerFields.repayment_frequency = offer.repayment_frequency
    }


    try {
        let application = await Application.findOne({ id: req.params.id});
        if (!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        if(application.status !== "PENDING") {
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
            let business = await Business.findOne({ id: application.borrower_id })
            //verify state is supported (ie it's not PR, guam etc)
            if(!(business.address.state in commercial_state_limits)) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } 

            const state = commercial_state_limits[business.address.state]

            // verify Pier has limits for the state
            if(Object.keys(state).length === 0) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
            
            // verify if either type 1 or type 2 supports the offer
            const limit_1 = state.limit_1
            const limit_2 = state.limit_2

            const business_type = business.business_type.toLowerCase()
            //type 1
            if ((offer.amount >= limit_1.amount.min && 
                offer.amount <= limit_1.amount.max &&
                offer.interest_rate <= limit_1.max_apr &&
                offer.apr <= limit_1.max_apr &&
                limit_1.business_types.includes(business_type)) ||
                // type 2
                (
                    offer.amount >= limit_2?.amount.min &&
                    offer.amount <= limit_2?.amount.max &&
                    offer.interest_rate <= limit_2?.max_apr &&
                    offer.apr <= limit_2?.max_apr &&
                    limit_2?.business_types.includes(business_type)
                )) {
                    // accept approval if offer meets type 1 or type 2
                    application.offer = offerFields
                    application.status = 'APPROVED'
                    application.decisioned_on = Date.now();
                    await application.save()

                    application = await Application.findOne({ id: req.params.id })
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
            let consumer = await Consumer.findOne({ id: application.borrower_id })
            //verify state is supported (ie it's not PR, guam etc)
            if(!(consumer.address.state in consumer_state_limits)) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } 

            const state = consumer_state_limits[consumer.address.state]

            // verify Pier has limits for the state
            if(Object.keys(state).length === 0) {
                const error = getError("state_not_supported")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } 
            
            // verify if either limit type 1 
            const limit_1 = state.limit_1
            console.log(`limit_1: ${limit_1}`)

            if ((offer.amount >= limit_1.amount.min && 
                offer.amount <= limit_1.amount.max &&
                offer.apr <= limit_1.max_apr &&
                offer.interest_rate <= limit_1.max_apr )) {
                    // accept approval if offer meets type 1
                    application.offer = offerFields
                    application.status = 'APPROVED'
                    application.decisioned_on = Date.now();
                    await application.save()
                    application = await Application.findOne({ id: req.params.id })
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
        const application = await Application.findOne({ id: req.params.id })
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