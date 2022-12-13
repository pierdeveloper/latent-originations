const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const Business = require('../../models/Business');
const { validationResult } = require('express-validator');
const { businessValidationRules } = require('../../helpers/validator.js');

// @route     POST user
// @desc      Create a business user
// @access    Public
router.post('/', [auth, businessValidationRules()], async (req, res) => {
    
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array()});
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
            return res.status(400).json({ errors: [ { msg: 'Business with this EIN already exists' }] });
        }

        business = new Business({
            address,
            beneficial_owners,
            business_contact,
            business_name,
            business_type,
            client_id,
            dba_name,
            ein,
            incorporation_date,
            kyc_completion_date,
            phone
        })
        
        await business.save()

        res.json(business)

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});


// @route     PATCH business borrower
// @desc      Update a business user
// @access    Public
router.patch('/:id', [auth, businessValidationRules()], async (req, res) => {
    try {
        // find the user
        let business = await Business.findById(req.params.id);
        if (!business || business.client_id !== req.client_id) {
            return res.status(404).json({ msg: 'Business not found' })
        }
        // validations
        const errors = validationResult(req);
        if(!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array()});
        }
        // update and return
        const { address, beneficial_owners,
            business_contact,
            business_name, 
            business_type, 
            dba_name, 
            ein, 
            incorporation_date, 
            kyc_completion_date } = req.body

        const businessFields = {};
        if(address) businessFields.address = address;
        if(beneficial_owners) businessFields.beneficial_owners = beneficial_owners;
        if(business_contact) businessFields.business_contact = business_contact;
        if(business_name) businessFields.business_name = business_name;
        if(business_type) businessFields.business_type = business_type;
        if(dba_name) businessFields.dba_name = dba_name;
        if(ein) businessFields.ein = ein;
        if(incorporation_date) businessFields.incorporation_date = incorporation_date;
        if(kyc_completion_date) businessFields.kyc_completion_date = kyc_completion_date;
    
        business = await Business.findOneAndUpdate(
            {_id: req.params.id},
            { $set: businessFields },
            { new: true}    
        )

        return res.json(business)

    } catch (err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Business id does not exist' });
        }
        res.status(500).send("Server Error");
    }
});


// @route     GET business borrower by id
// @desc      Retrieve a business borrower's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    try {
        const business = await Business.findById(req.params.id);
        if(!business || business.client_id !== req.client_id) {
            return res.status(404).json({ msg: 'Business not found' });
        }
        res.json(business);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Business id does not exist' });
        }
        res.status(500).send('Server Error');
    }
})

// @route     GET business borrowers
// @desc      List all business borrowers
// @access    Public
router.get('/', [auth], async (req, res) => {
    try {
        const businesses = await Business.find({ client_id: req.client_id });
        res.json(businesses);
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})


module.exports = router;