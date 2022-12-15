const { getError } = require('../../helpers/errors.js')
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const Consumer = require('../../models/Consumer');
const Borrower = require('../../models/Borrower');
const { validationResult } = require('express-validator');
const { consumerValidationRules } = require('../../helpers/validator.js');

// @route     POST user
// @desc      Create a consumer user
// @access    Public
router.post('/', [auth, consumerValidationRules()], async (req, res) => {
    
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array()});
    }

    try {
        const client_id = req.client_id

        const { address, date_of_birth,
            email,
            first_name,
            last_name,
            kyc_completion_date,
            phone,
            ssn } = req.body

        let consumer = await Consumer.findOne({ ssn, client_id })

        if (consumer) {
            const error = getError("duplicate_ssn")
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
            type: "consumer",
            client_id: client_id
        });

        await borrower.save();

        // create business and set the borrower_id on it
        consumer = new Consumer({
            address,
            borrower_id,
            date_of_birth,
            email,
            first_name,
            last_name,
            client_id,
            kyc_completion_date,
            phone,
            ssn
        });
        
        await consumer.save();

        res.json(consumer);

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


// @route     PATCH consumer borrower
// @desc      Update a consumer borrower
// @access    Public
router.patch('/:id', [auth, consumerValidationRules()], async (req, res) => {
    //TODO - check for SSN uniqueness on update call
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
        // find the consumer 
        let consumer = await Consumer.findOne({ borrower_id: req.params.id });
        if (!consumer || consumer.client_id !== req.client_id) {
            console.log('consumer not found');
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
            return res.status(400).json({ errors: errors.array()});
        }
        // update and return
        const { address,
            date_of_birth,
            email,
            first_name,
            last_name,
            kyc_completion_date,
            phone,
            ssn } = req.body
        
        if(address) consumer.address = address;
        if(date_of_birth) consumer.date_of_birth = date_of_birth;
        if(email) consumer.email = email;
        if(first_name) consumer.first_name = first_name;
        if(last_name) consumer.last_name = last_name;
        if(kyc_completion_date) consumer.kyc_completion_date = kyc_completion_date;
        if(phone) consumer.phone = phone;
        if(ssn) consumer.ssn = ssn;

        await consumer.save()

        return res.json(consumer)

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

        const consumer = await Consumer.findOne({ borrower_id: req.params.id });
        if(!consumer || consumer.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        res.json(consumer);
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

// @route     GET consumer borrowers
// @desc      List all consumer borrowers
// @access    Public
router.get('/', [auth], async (req, res) => {
    try {
        const consumers = await Consumer.find({ client_id: req.client_id });
        res.json(consumers);
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