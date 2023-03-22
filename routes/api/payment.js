const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const Customer = require('../../models/Customer');
const Payment = require('../../models/Payment');
const { getError } = require('../../helpers/errors.js');
const { validationResult } = require('express-validator');
const { paymentValidationRules } = require('../../helpers/validator.js');
const Facility = require('../../models/Facility');
const { v4: uuidv4 } = require('uuid');

// @route     POST payments
// @desc      Add a payment submission
// @access    Public
router.post('/', [auth, paymentValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

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

    try {
        const client_id = req.client_id;
        const { amount, date, transfer_type,
            facility_id  } = req.body

        // check that facility exists
        const facility = await Facility.findOne({ id: facility_id });
        if(!facility || facility.client_id !== client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // check that facility has repayment bank info
        const bank_details = facility.repayment_bank_details;
        if(!bank_details || 
            !bank_details.bank_account_number ||
            !bank_details.bank_account_routing) {
                const error = getError("missing_repayment_bank_details")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }

        // check that customer is enabled for ach
        // TODO

        // create the payment id
        const payment_id = 'pmt_' + uuidv4().replace(/-/g, '');

        // create payment resource
        let payment = new Payment({
            id: payment_id,
            facility_id,
            client_id,
            amount,
            date,
            transfer_type,
            bank_account_number: facility.repayment_bank_details.bank_account_number,
            bank_account_routing: facility.repayment_bank_details.bank_account_routing,
            bank_account_type: facility.repayment_bank_details.type
        })
        
        await payment.save()

        payment = await Payment.findOne({ id: payment_id })
            .select('-_id -__v -client_id');
        console.log(payment)
        res.json(payment);

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

// @route     GET consumer credit coverage
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.get('/consumer', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        // pull up customer and increment coverage counter
        let customer = await Customer.findOne({ client_id: req.client_id });
        customer.coverage_pull_count.consumer++;
        await customer.save();

        const states = consumer_state_limits;
        console.log(states); 
        res.json(states);
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