const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const Customer = require('../../models/Customer');
const { getError } = require('../../helpers/errors.js');
const { checkOfferValidationRules } = require('../../helpers/validator.js');
const { validationResult } = require('express-validator');
const { calculateAPR } = require('../../helpers/nls.js');
const { calculate_periodic_payment } = require('../../helpers/docspring.js');
const { moher } = require('../../helpers/coverage/moher.js');

// @route     GET commercial credit coverage
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.get('/commercial', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        // pull up customer and increment coverage counter
        let customer = await Customer.findOne({ client_id: req.client_id });
        customer.coverage_pull_count.commercial++;
        customer.save();

        // return limits
        const states = commercial_state_limits;
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


// @route     POST /check_offers
// @desc      Check a set of offers against our limits for a given state
// @access    Public

router.post('/check_offers', [auth, checkOfferValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // validate that state is valid and offers is array with length > 0
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "API_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    const {
        state, 
        offers 
    } = req.body


    // validate that all offers have an id field
    const offer_ids = offers.map(offer => offer.id);
    const offer_ids_with_id = offer_ids.filter(id => id !== undefined);
    if(offer_ids.length !== offer_ids_with_id.length) {
        const response = {
            error_type: "API_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: "Each offer must have an id"
        }
        return res.status(400).json(response);
    }

    // validate that each offer has a unique id
    const unique_ids = new Set(offer_ids);
    if(offer_ids.length !== unique_ids.size) {
        const response = {
            error_type: "API_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: "Each offer must have a unique id"
        }
        return res.status(400).json(response);
    }

    // create response object
    const check_offers_response = {}

    // for each offer, check if it is within our limits
    for(let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const offer_id = offer.id;

        // check if offer amount is within our limits
        var offer_amount_within_limits = false // default false


        const state_thresholds = consumer_state_limits[state]

        // verify Pier has limits for the state
        if(Object.keys(state_thresholds).length === 0) {
            console.log('no pier limits exist');
        } 


        const isOfferCompliant = moher(offer, state)

        if(isOfferCompliant) {
            console.log('offer limits are valid!')
            // update bool
            offer_amount_within_limits = true
        } else {
            // unsupported
            console.log('unsupported limits')
        }

        // ~~~~~ 
        //calculate APR
        // ~~~~~

        // calc loan amount
        const loan_amount = offer.amount / 100;
        //const disbursement_amount = loan_amount - origination_fee_amount / 100;
        const repayment_frequency = offer.repayment_frequency;
        // calc payments per year
        const payments_per_year = repayment_frequency === 'monthly' 
            ? 12 : repayment_frequency === 'biweekly' 
            ? 26 : repayment_frequency === 'semi_monthly'
            ? 24 : repayment_frequency === 'weekly'
            ? 52 : null;

        // calc periodic payment amount
        const periodic_payment_amount = calculate_periodic_payment(
            loan_amount,
            offer.term,
            payments_per_year,
            offer.interest_rate / 10000
        );

        console.log('periodic payment amount: ', periodic_payment_amount)
        // calc offer
        var apr = await calculateAPR(offer, periodic_payment_amount);
        console.log('APR: ', apr)
        if(apr === 'nls_error') { apr = null} 
         // add offer to response object
         check_offers_response[offer_id] = {
            is_compliant: offer_amount_within_limits,
            apr: apr
        }
    }

    // return response
    console.log(check_offers_response)
    res.json(check_offers_response);

})

module.exports = router;