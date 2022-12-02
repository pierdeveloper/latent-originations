const config = require('config');
const express = require('express');
const router = express.Router();
const Business = require('../../models/Business');
const { check, validationResult } = require('express-validator');

// @route     POST user
// @desc      Create a business user
// @access    Public
router.post('/', 
    [
        check('address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(config.states),
        check('beneficial_owners.*.address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('beneficial_owners.*.address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('beneficial_owners.*.address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(config.states),
        check('beneficial_owners.*.date_of_birth', 'Date of Birth format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('beneficial_owners.*.email', 'Email must be a valid email')
            .isEmail(),
        check('beneficial_owners.*.phone', 'Phone must be a 10-digit US number')
            .isNumeric().isLength({min:10, max:10}),
        check('beneficial_owners.*.ssn', 'SSN must be 9-digits')
            .isLength({min:9, max:9}).isNumeric(),
        check('business_contact.email', 'Email must be a valid email')
            .isEmail(),
        check('business_contact.phone', 'Phone must be a 10-digit US number')
            .isNumeric().isLength({min:10, max:10}),
        check('business_name', 'Business name max length is 256 chars')
            .isLength({max:256}),
        check('business_type','Business type must be one of CORPORATION or LLC')
            .isIn(['CORPORATION', 'LLC']),
        check('dba_name', 'DBA name max length is 256 chars')
            .isLength({max:256}),
        check('ein', 'EIN must be 9 digits')
            .isLength({min:9, max:9}).isNumeric(),
        check('incorporation_date', 'Incorporation date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('kyc_completion_date', 'KYC completion date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true})
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if(!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array()});
        }
        try {
            const { address, beneficial_owners,
                business_contact,
                business_name, 
                business_type, 
                dba_name, 
                ein, 
                incorporation_date, 
                kyc_completion_date } = req.body

            let business = await Business.findOne({ ein })

            if (business) {
                return res.status(400).json({ errors: [ { msg: 'Business with this EIN already exists' }] });
            }

            business = new Business({
                address,
                beneficial_owners,
                business_contact,
                business_name,
                business_type,
                dba_name,
                ein,
                incorporation_date,
                kyc_completion_date
            })
            
            await business.save()

            res.json(business)

        } catch (err) {
            console.error(err.message);
            res.status(500).send("Server Error");
        }
    });


// @route     PUT business borrower
// @desc      Update a business user
// @access    Public
router.put('/', 
    [
        check('address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(config.states),
        check('beneficial_owners.*.address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('beneficial_owners.*.address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('beneficial_owners.*.address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(config.states),
        check('beneficial_owners.*.date_of_birth', 'Date of Birth format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('beneficial_owners.*.email', 'Email must be a valid email')
            .isEmail(),
        check('beneficial_owners.*.phone', 'Phone must be a 10-digit US number')
            .isNumeric().isLength({min:10, max:10}),
        check('beneficial_owners.*.ssn', 'SSN must be 9-digits')
            .isLength({min:9, max:9}).isNumeric(),
        check('business_contact.email', 'Email must be a valid email')
            .isEmail(),
        check('business_contact.phone', 'Phone must be a 10-digit US number')
            .isNumeric().isLength({min:10, max:10}),
        check('business_name', 'Business name max length is 256 chars')
            .isLength({max:256}),
        check('business_type','Business type must be one of CORPORATION or LLC')
            .isIn(['CORPORATION', 'LLC']),
        check('dba_name', 'DBA name max length is 256 chars')
            .isLength({max:256}),
        check('ein', 'EIN must be 9 digits')
            .isLength({min:9, max:9}).isNumeric(),
        check('incorporation_date', 'Incorporation date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('kyc_completion_date', 'KYC completion date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true})
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if(!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array()});
        }
        try {
            const { address, beneficial_owners,
                business_contact,
                business_name, 
                business_type, 
                dba_name, 
                ein, 
                incorporation_date, 
                kyc_completion_date } = req.body

            let business = await Business.findOne({ ein })

            if (business) {
                return res.status(400).json({ errors: [ { msg: 'Business with this EIN already exists' }] });
            }

            business = new Business({
                address,
                beneficial_owners,
                business_contact,
                business_name,
                business_type,
                dba_name,
                ein,
                incorporation_date,
                kyc_completion_date
            })
            
            await business.save()

            res.json(business)

        } catch (err) {
            console.error(err.message);
            res.status(500).send("Server Error");
        }
    });

module.exports = router;