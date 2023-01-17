const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Application = require('../../models/Application');
const Facility = require('../../models/Facility');
const { validationResult } = require('express-validator');
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const valid_rejection_reasons = require('../../helpers/rejectionReasons.json');

// @route     POST facility
// @desc      Create a credit facility
// @access    Public
router.post('/', [auth], async (req, res) => {
    const client_id = req.client_id
    const { loan_agreement_id } = req.body

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

        // confirm loan_agreement status is SIGNED
        if(loan_agreement.status !== 'signed') {
            const error = getError("facility_cannot_be_created")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Confirm a facility for this loan agreement does not already exist
        let existingFacility = await Facility
            .findOne({ loan_agreement_id: loan_agreement.id });
        if(existingFacility) {
            const error = getError("facility_already_exists")
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
        const credit_type = application.credit_type;

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

// @route POST facility/close
// @desc Close a facility
// @access Public
router.post('/:id/close', [auth], async (req, res) => {

    try {
        let facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        if(facility.status === "closed") {
            const error = getError("facility_cannot_be_closed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        facility.status = 'closed'
       
        await facility.save()
        facility = await Facility.findOne({ id: req.params.id })
            .select('-_id -__v -client_id');
        res.json(facility)

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


// @route     GET facility by id
// @desc      Retrieve an facility's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    try {
        const facility = await Facility.findOne({ id: req.params.id })
            .select('-_id -__v');
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        facility.client_id = undefined;
        res.json(facility);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_facility_id")
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

// @route     GET facilities
// @desc      List all facilities
// @access    Public
router.get('/', [auth], async (req, res) => {
    try {
        const facilities = await Facility.find({ client_id: req.client_id })
            .select('-_id -__v -client_id');
        res.json(facilities);
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