const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const config = require('config');
const router = express.Router();
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
        return res.status(400).json({ errors: errors.array()});
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
        res.json(application);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// @route PATCH applications/reject
// @desc Reject credit application
// @access Public
router.patch('/:id/reject', [auth, rejectionValidationRules()], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const rejection_reason = req.body.rejection_reason


    const rejectionFields = {}
    rejectionFields.reason = rejection_reason
    rejectionFields.reason_message = config.rejection_reasons.get(rejection_reason)

    try {
        let application = await Application.findOne({ application_id: req.params.id });
        if(!application || application.client_id !== req.client_id) {
            return res.status(404).json({ msg: 'Application not found'});
        }

        if(application.status !== "pending") {
            return res.status(404).json({ msg: 'Only applications with a status=pending can be rejected' });
        }

        application.rejection = rejectionFields
        application.status = 'rejected'
        await application.save()
        res.json(application)

    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
})

// @route PATCH application
// @desc Approve credit application
// @access Public
router.patch('/:id/approve', [auth, offerValidationRules()], async (req, res) => {

    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array()});
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
            return res.status(404).json({ msg: 'Application not found' })
        }

        if(application.status !== "pending") {
            return res.status(404).json({ msg: 'Only applications with a status=pending can be approved' });
        }

        let business = await Business.findOne({ borrower_id: application.borrower_id })
        console.log('business info')
        console.log(business)
        //verify state is supported (ie it's not PR, guam etc)
        if(!(business.address.state in config.commercial_state_limits)) {
            return res.status(404).json({ msg: 'Territory not supported' });
        } 

        // verify Pier has limits for the state
        if(Object.keys(config.commercial_state_limits.get(business.address.state)).length === 0) {
            return res.status(404).json({ msg: 'Pier does not currently support loans to this state' });
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
                res.json(application)
            } else {
                // otherwise reject
                return res.status(404).json({ msg: 'Loan offer terms not supported. See state coverage list' });
            }
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
})

// @route     GET application by id
// @desc      Retrieve an application's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    try {
        const application = await Application.findOne({ application_id: req.params.id });
        if(!application || application.client_id !== req.client_id) {
            return res.status(404).json({ msg: 'Application not found' });
        }
        res.json(application);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Application id does not exist' });
        }
        res.status(500).send('Server Error');
    }
})

// @route     GET applications
// @desc      List all applications
// @access    Public
router.get('/', [auth], async (req, res) => {
    try {
        const applications = await Application.find({ client_id: req.client_id });
        res.json(applications);
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})


module.exports = router;