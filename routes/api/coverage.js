const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const Customer = require('../../models/Customer');
const { getError } = require('../../helpers/errors.js');
const { checkOfferValidationRules, offerValidationRules } = require('../../helpers/validator.js');
const { validationResult } = require('express-validator');
const { calculateAPR, calculateAPRs, check_offer_aprs } = require('../../helpers/nls.js');
const { calculate_periodic_payment } = require('../../helpers/docspring.js');
const { moher } = require('../../helpers/coverage/moher.js');
const validator = require('validator');
const moment = require('moment');

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

    const customer = await Customer.findOne({ client_id: req.client_id });

    // validate that state has limits
    const state_thresholds = consumer_state_limits[state]

    // verify Pier has limits for the state
    if(Object.keys(state_thresholds).length === 0) {
        const response = {
            error_type: "API_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: "State not supported"
        }
        return res.status(400).json(response);
    } 

    // validate that max offer count is 40
    if(offers.length > 40) {
        const response = {
            error_type: "API_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: "Max offer count is 40"
        }
        return res.status(400).json(response);
    }

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

    // pre populate response object with offer ids
    for(let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const offer_id = offer.id;
        check_offers_response[offer_id] = {
            is_compliant: null,
            apr: null
        }
    }

    // for each offer, check basic validations and calc periodic payment
    for(let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const offer_id = offer.id;

        // check if offer amount is within our limits
        var offer_amount_within_limits = false // default false

        // check validations on offer
        // ** NOTE! these validations are defined separately in this file, so the validator.js is not used here
        const offer_passes_validations = validateOffer(offer);
        if(!offer_passes_validations) {
            check_offers_response[offer_id] = {
                is_compliant: false,
                apr: null
            }
            console.log('offer does not pass validations')
            continue;
        }


        // calc loan amount
        const loan_amount = offer.amount / 100;
        //const disbursement_amount = loan_amount - origination_fee_amount / 100;
        const repayment_frequency = offer.repayment_frequency;
        // calc payments per year
        const payments_per_year = repayment_frequency === 'monthly' ? 12
            : repayment_frequency === 'biweekly' ? 26
            : repayment_frequency === 'semi_monthly' ? 24
            : repayment_frequency === 'semi_monthly_14' ? 24
            : repayment_frequency === 'semi_monthly_first_15th' ? 24
            : repayment_frequency === 'semi_monthly_last_15th' ? 24
            : repayment_frequency === 'weekly' ? 52
            : 24;

        // calc periodic payment amount
        const periodic_payment_amount = calculate_periodic_payment(
            loan_amount,
            offer.term,
            payments_per_year,
            offer.interest_rate / 10000
        );
        offer.periodic_payment = periodic_payment_amount;

        console.log('periodic payment amount: ', periodic_payment_amount)

    }

    // create an offers list with only offers that where is_compliant is null or true
    const offers_to_check = offers.filter(offer => {
        const offer_id = offer.id;
        const is_compliant = check_offers_response[offer_id].is_compliant;
        return is_compliant === null || is_compliant === true;
    })

    // calc aprs for each offer
    const aprs = await calculateAPRs(offers_to_check);
    //const aprs = {'25': 3000}

    // update offers with aprs 
    for(let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        const offer_id = offer.id;
        const apr = aprs[offer_id];
        offer.apr = apr;
    }
    console.log('offers: ', offers)

    // temp white list logic for pull


    // for each offer, check if it is within our limits
    for(let i = 0; i < offers.length; i++) {
        const offer = offers[i];
        if(check_offers_response[offer.id].is_compliant === false) continue;
        /*

        // calc offer
        var apr = await calculateAPR(offer, periodic_payment_amount);
        console.log('APR: ', apr)
        if(apr === 'nls_error') { apr = null} 

        offer.apr = apr
        */
        var offer_amount_within_limits = false // default false

        const isOfferCompliant = moher(offer, state)

        var apr = offer.apr 

        if(isOfferCompliant) {
            console.log('offer limits are valid!')
            // update bool
            offer_amount_within_limits = true
        } else {
            // unsupported
            console.log('unsupported limits')
            apr = null
        }

         // add offer to response object
         check_offers_response[offer.id] = {
            is_compliant: offer_amount_within_limits,
            apr: apr
        }
    }

    // return response
    console.log(check_offers_response)
    res.json(check_offers_response);

})



const validateOffer = (offer) => {
    const checkIsIntAndInRange = (value, min, max) => {
        if (!validator.isInt(value + '', {min, max})) {
            return false;
        }
        return true;
    };

    const checkIsInArray = (value, array) => {
        if (!validator.isIn(value, array)) {
            return false;
        }
        return true;
    };

    const validRepaymentFrequencies = ['weekly', 'biweekly', 'semi_monthly_first_15th', 'semi_monthly_last_15th', 'semi_monthly', 'semi_monthly_14', 'monthly'];
    
    // Common checks
    if (!checkIsIntAndInRange(offer.amount, 0, Infinity)) {
        console.log('amount does not pass validation')
        return false;
    } 
    if (!checkIsIntAndInRange(offer.interest_rate, 0, Infinity)) {
        console.log('interest rate does not pass validation')
        return false;
    }
    if (!checkIsIntAndInRange(offer.origination_fee, 0, Infinity)) {
        console.log('origination fee does not pass validation')
        return false;
    }
    if (offer.repayment_frequency != null && !checkIsInArray(offer.repayment_frequency, validRepaymentFrequencies)) {
        console.log('repayment frequency does not pass validation')
        return false;
    }

    // Term checks
    if (offer.term != null && !checkIsIntAndInRange(offer.term, 3, 260)) {
        console.log('term does not pass validation')
        return false;
    }
    if (offer.term != null && offer.repayment_frequency === 'weekly' && !checkIsIntAndInRange(offer.term, 13, 260)) {
        console.log('term does not pass validation')
        return false;
    }
    if (offer.term != null && offer.repayment_frequency === 'biweekly' && !checkIsIntAndInRange(offer.term, 7, 130)) {
        console.log('term does not pass validation')
        return false;
    }
    if (offer.term != null && offer.repayment_frequency === 'semi_monthly' && !checkIsIntAndInRange(offer.term, 6, 120)) {
        console.log('term does not pass validation')
        return false;
    }
    if (offer.term != null && offer.repayment_frequency === 'semi_monthly_14' && !checkIsIntAndInRange(offer.term, 6, 120)) {   
        console.log('term does not pass validation')
        return false;
    }
    if (offer.term != null && offer.repayment_frequency === 'semi_monthly_first_15th' && !checkIsIntAndInRange(offer.term, 6, 120)) {
        console.log('term does not pass validation')
        return false;
    }
    if (offer.term != null && offer.repayment_frequency === 'semi_monthly_last_15th' && !checkIsIntAndInRange(offer.term, 6, 120)) {
        console.log('term does not pass validation')    
        return false;
    }
    if (offer.term != null && offer.repayment_frequency === 'monthly' && !checkIsIntAndInRange(offer.term, 3, 60)) {
        console.log('term does not pass validation')
        return false;
    }
    
    // Check first payment date
    if (offer.first_payment_date) {
        const date = moment(offer.first_payment_date, 'YYYY-MM-DD');
        if (!date.isValid()) {
            console.log('first payment date does not pass validation bc it is not valid')
            return false;
        }
        if (!date.isAfter(moment())) {
            console.log('first payment date does not pass validation bc it is not after today')
            return false;
        }
        if (date.diff(moment(), 'days') > 45) {
            console.log('first payment date does not pass validation bc it is more than 45 days in the future')
            return false;
        }
        if (offer.repayment_frequency === "semi_monthly_first_15th" && (date.date() !== 1 && date.date() !== 15)) {

            return false;
        }
        if (offer.repayment_frequency === "semi_monthly_last_15th" && (date.date() !== 15 && date.date() !== date.daysInMonth())) {
            return false;
        }
    }

    return true;
}



module.exports = router;