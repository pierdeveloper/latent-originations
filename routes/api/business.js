const { getError } = require('../../helpers/errors.js')
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const Business = require('../../models/Business');
const Borrower = require('../../models/Borrower');
const { validationResult } = require('express-validator');
const { businessValidationRules } = require('../../helpers/validator.js');

// @route     POST user
// @desc      Create a business user
// @access    Public
router.post('/', [auth, businessValidationRules()], async (req, res) => {
    
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "invalid_input",
            error_code: 400,
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    try {
        const client_id = req.client_id

        const { address, beneficial_owners,
            business_contact,
            business_name, 
            business_type, 
            dba_name, 
            ein, 
            incorporation_date, 
            kyc_completion_date,
            phone } = req.body

        let business = await Business.findOne({ ein, client_id })

        if (business) {
            const error = getError("duplicate_ein")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // create borrower
        const borrower_id = 'bor_' + uuidv4().replace(/-/g, '');
        let borrower = new Borrower({
            id: borrower_id,
            type: "business",
            client_id: client_id
        });

        await borrower.save();

        // create business and set the borrower_id on it
        business = new Business({
            address,
            beneficial_owners,
            borrower_id,
            business_contact,
            business_name,
            business_type,
            client_id,
            dba_name,
            ein,
            incorporation_date,
            kyc_completion_date,
            phone
        });
        
        await business.save();

        business = await Business.findOne({ ein, client_id })
            .select('-_id -__v -client_id');

        res.json(business);

    } catch (err) {
        console.log(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});


// @route     PATCH business borrower
// @desc      Update a business user
// @access    Public
router.patch('/:id', [auth, businessValidationRules()], async (req, res) => {
    //TODO - check for EIN uniqueness on update call
    try {
        //lookup borrower
        let borrower = await Borrower.findOne({ id: req.params.id })
        if(!borrower || borrower.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // find the business 
        let business = await Business.findOne({ borrower_id: req.params.id });
        if (!business || business.client_id !== req.client_id) {
            console.log('business not found');
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // validations
        const errors = validationResult(req);
        if(!errors.isEmpty()) {
            const response = {
                error_type: "invalid_input",
                error_code: 400,
                error_message: "A value provided in the body is incorrect. See error_detail for more",
                error_detail: errors.array()
            }
            return res.status(400).json(response);
        }
        // update and return
        const { address, beneficial_owners,
            business_contact,
            business_name, 
            business_type, 
            dba_name, 
            ein, 
            incorporation_date, 
            kyc_completion_date,
            phone } = req.body
        
        if(address) business.address = address;
        if(beneficial_owners) business.beneficial_owners = beneficial_owners;
        if(business_contact) business.business_contact = business_contact;
        if(business_name) business.business_name = business_name;
        if(business_type) business.business_type = business_type;
        if(dba_name) business.dba_name = dba_name;
        if(ein) business.ein = ein;
        if(incorporation_date) business.incorporation_date = incorporation_date;
        if(kyc_completion_date) business.kyc_completion_date = kyc_completion_date;
        if(phone) business.phone = phone;

        await business.save()

        business = await Business.findOne({ borrower_id: req.params.id })
            .select('-_id -__v -client_id');

        return res.json(business)

    } catch (err) {
        console.log(err)
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_borrower_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});


// @route     GET business borrower by id
// @desc      Retrieve a business borrower's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    try {
        //lookup borrower
        let borrower = await Borrower.findOne({ id: req.params.id })
        if(!borrower || borrower.client_id !== req.client_id) {
            console.log('borrower not found');
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        const business = await Business.findOne({ borrower_id: req.params.id })
            .select('-_id -__v');
        if(!business || business.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        business.client_id = undefined;
        res.json(business);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_borrower_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET business borrowers
// @desc      List all business borrowers
// @access    Public
router.get('/', [auth], async (req, res) => {
    try {
        const businesses = await Business.find({ client_id: req.client_id })
            .select('-_id -__v -client_id');
        res.json(businesses);
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