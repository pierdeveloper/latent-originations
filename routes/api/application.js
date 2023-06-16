const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Application = require('../../models/Application');
const { validationResult } = require('express-validator');
const { applicationValidationRules, 
        offerValidationRules,
        rejectionValidationRules, 
        customerValidationRules,
        validationMiddleware} = require('../../helpers/validator.js');
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const valid_rejection_reasons = require('../../helpers/rejectionReasons.json');
const Customer = require('../../models/Customer.js');
const {CreditPolicy} = require('../../models/CreditPolicy.js');
const rejectionReasons = require('../../helpers/rejectionReasons.json');
const {generateCRSTokenTest, pullSoftExperianReport, experianBankruptcyCodes} = require('../../helpers/crs.js');
const { ConsoleLogger } = require('@slack/logger');
const { WebClient } = require('@slack/web-api');
const  { moher } = require('../../helpers/coverage/moher.js');
const config = require('config');

// @route     POST application
// @desc      Create a credit application
// @access    Public
router.post('/', [auth, applicationValidationRules()], async (req, res) => {
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
        const { 
            borrower_id, 
            credit_type, 
            third_party_disbursement_destination,
        } = req.body
        // check that borrower exists
        let borrower = await Borrower.findOne({ id: borrower_id })
        if(!borrower || borrower.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // check that application credit type and borrower type match
        if((borrower.type === 'business' && [
            'consumer_bnpl', 'consumer_revolving_line_of_credit', 'consumer_closed_line_of_credit', 
            'consumer_installment_loan'].includes(credit_type))

            || (borrower.type === 'consumer' && [
                'commercial_bnpl', 'commercial_revolving_line_of_credit', 'commercial_closed_line_of_credit', 
                'commercial_installment_loan'].includes(credit_type))
        ) {
            console.log('credit type cant be made for this borrower type')
            const error = getError("application_cannot_be_created")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // create and save application
        const application_id = 'app_' + uuidv4().replace(/-/g, '');
        const applicationFields = {}
        applicationFields.id = application_id;
        applicationFields.borrower_id = borrower_id;
        applicationFields.client_id = client_id;
        applicationFields.credit_type = credit_type;
        if(third_party_disbursement_destination) applicationFields.third_party_disbursement_destination = third_party_disbursement_destination;
        let application = new Application(applicationFields);
        await application.save()

        // resopnd with application
        application = await Application.findOne({ id: application_id })
            .select('-_id -__v -client_id');
        console.log(application)
        res.json(application);

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

// temp crs testing endpoint
router.post('/crs', [auth], async (req, res) => {
    
    const consumer = {
        first_name: "ANDERSON",
        last_name: "LAURIE",
        address: {
            line_1: "9817 LOOP BLVD",
            line_2: "APT G",
            city: "CALIFORNIA CITY",
            state: "CA",
            zip: "935051352"
        },
        date_of_birth: "1998-08-01",
        ssn: "5e938569e92cb9d33204089904b55b80",
        phone: "0000000000"
    }

    const payload = {
        "firstName": "ANDERSON",
        "lastName": "LAURIE",
        "nameSuffix": "SR",
        "street1": "9817 LOOP BLVD",
        "street2": "APT G",
        "city": "CALIFORNIA CITY",
        "state": "CA",
        "zip": "935051352",
        "ssn": "666455730",
        "dob": "1998-08-01",
        "phone": "0000000000"
    }
    // pull report
    const experianReport = await pullSoftExperianReport(consumer)

/*
    const ficoScore = experianReport.riskModel[0].score
    const publicRecord = experianReport.publicRecord
    const underwritingData = {
        fico_score: ficoScore,
        public_record: publicRecord
    }
    */
    res.status(200).json(experianReport)

})


// @route POST applications/evaluate
// @desc Evaluate a credit application
// @access Public
router.post('/:id/evaluate', [auth, offerValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // get client config
    const customer = await Customer.findOne({ client_id: req.client_id })
    
    // require underwriting enabled for production
    if(process.env.NODE_ENV !== 'development' && !customer.underwriting_enabled) {
        const error = getError("unsupported_product")
        return res.status(error.error_status).json({
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }

    const { offer } = req.body

    // build offer object
    const offerFields = {};
    offerFields.amount = offer.amount;
    offerFields.interest_rate = offer.interest_rate;
    offerFields.late_payment_fee = offer.late_payment_fee;
    offerFields.grace_period = offer.grace_period;
    offerFields.origination_fee = offer.origination_fee;
    offerFields.finance_charge = offer.finance_charge;
    offerFields.term = offer.term;

    if(offer.hasOwnProperty("annual_fee")) {
        offerFields.annual_fee = offer.annual_fee
    }
    if(offer.hasOwnProperty("billing_cycle")) {
        offerFields.billing_cycle = offer.billing_cycle
    }
    if(offer.hasOwnProperty("grace_period_interest_rate")) {
        offerFields.grace_period_interest_rate = offer.grace_period_interest_rate
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
    if(offer.hasOwnProperty("third_party_disbursement_destination")) {
        offerFields.third_party_disbursement_destination = offer.third_party_disbursement_destination
    }

    try {
        // pull in application
        var application = await Application.findOne({ id: req.params.id});
        // confirm application exists
        if (!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm application can be evaluated
        if(application.status !== "pending") {
            const error = getError("application_cannot_be_evaluated")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // for bnpl confirm that a third party disbursement destination exists
        if(['consumer_bnpl', 'commercial_bnpl'].includes(application.credit_type)) {
            if(!offer.hasOwnProperty("third_party_disbursement_destination")) {
                const error = getError("third_party_missing")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
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

        /////
       
        // get applicant info
        let consumer = await Consumer.findOne({ id: application.borrower_id })
        //verify state is supported (ie it's not PR, guam etc)
        console.log(`state: ${consumer.address.state}`)
        if(!(consumer.address.state in consumer_state_limits)) {
            const error = getError("state_not_supported")
            console.log('state not found')
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
            console.log('no pier limits exist');
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        } 

        // verify customer is enabled for non-zero interest
        if(offer.interest_rate > 0 && !customer.consumer_non_zero_enabled) {
            const error = getError('non_zero_interest_not_enabled')
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        
        const isOfferCompliant = moher(offer, consumer.address.state)

        // check type 1
        if(isOfferCompliant) {
            // accept approval if offer meets type 1 or type 2
            console.log('offer limits are valid! time to underwrite..')

        } else {
            // otherwise reject
            const error = getError("unsupported_offer_terms")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }


        //////

        // TODO: verify decisioning is enabled for customer

        // pull in credit policy
        let credit_policy = await CreditPolicy.findOne({ 
            client_id: customer.client_id,
            status: 'deployed'
        })

        // verify customer has a deployed credit policy
        if(!credit_policy) {
            const error = getError("credit_policy_not_found")
            console.log('credit policy not found')
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        console.log('credit policy')
        console.log(credit_policy)


        // TODO: need to have a gate here to only pull credit when necessary!
        // check if credit should be pulled

        // TODO: pull credit from CRS if necessary
        /*
        let credit = crs.pullCredit(consumer)
        

        // perform validations on credit factors (ie it exists, is not missing/null, etc)

        // TODO: map credit report to application
        application.credit_data.fico = credit.fico
        application.credit_data.bankruptcy = credit.bankruptcy
        */

        const experianReport = await pullSoftExperianReport(consumer)

        // check for null report case
        if (!experianReport || experianReport === null) {
            const error = getError("internal_server_error")
            console.log('experian report object from CRS pull method is null or undefined')
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // check for no hit
        const informationalMessages = experianReport.informationalMessage
        let noHitDetected = informationalMessages?.some((msg) => {
            return msg.messageNumber === '07'
        })

        if(noHitDetected) {
            console.log('no hit scenario detected. Reject the application!')
            const rejection_reason = rejectionReasons['unable_to_verify_credit_information']
            application.rejection_reasons.push(rejection_reason)
        }

        // check for frozen account
        const statements = experianReport.statement
        let frozenAccountDetected = statements?.some((statement) => {
            return statement.type === '25'
        })

        if(frozenAccountDetected) {
            console.log('frozen account detected. Reject the application!')
            const rejection_reason = rejectionReasons['credit_file_frozen']
            application.rejection_reasons.push(rejection_reason)
        }

        var ficoScore = ""
        var publicRecord = []
        var tradeline = []

        // grab fico score
        if(experianReport.riskModel?.length > 0) {
            console.log(experianReport.riskModel.length)
            ficoScore = experianReport.riskModel[0].score
        } else { ficoScore = null }

        if(experianReport.publicRecord?.length > 0) {
            publicRecord = experianReport.publicRecord
        }
        if(experianReport.tradeline?.length > 0) {
            tradeline = experianReport.tradeline
        }

        console.log('experian status codes')
        console.log(experianBankruptcyCodes)
        let has_bankruptcy_history_in_public_record = publicRecord.some((record) => {
            return experianBankruptcyCodes.publicRecord.includes(record.status)
        })

        let has_bankruptcy_history_in_tradeline = tradeline.some((record) => {
            return experianBankruptcyCodes.tradeline.includes(record.status)
        })
        
        console.log('public record')
        console.log(publicRecord)
        
        if(!application.credit_data.fico) {
            application.credit_data.fico = ficoScore 
        }
        
        if(!application.credit_data.has_bankruptcy_history) {
            application.credit_data.has_bankruptcy_history = (
                has_bankruptcy_history_in_public_record ||
                has_bankruptcy_history_in_tradeline) ? true : false
        }
        

        console.log(application)
        //  set default values for credit data if missing in dev/sandbox
        /*
        if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'sandbox') {
            if(application.credit_data.fico === undefined) {
                application.credit_data.fico = 750
            } 
            if(application.credit_data.has_bankruptcy_history === undefined) {
                application.credit_data.has_bankruptcy_history = false
            }
        }*/

        // check if credit meets policy
        // loop thru each rule in credit policy
        let credit_policy_rules = credit_policy.rules
        let credit_policy_rules_length = credit_policy_rules.length
        let credit_policy_rules_passed = 0
        for(let i = 0; i < credit_policy_rules_length; i++) {
            if(noHitDetected || frozenAccountDetected) { break }
            let rule = credit_policy_rules[i]
            let rule_passed = false
            switch (rule.property) {
                case 'fico':
                    if(rule.operator === 'greater_than') {
                        if(application.credit_data.fico > rule.value) {
                            rule_passed = true
                        } else {
                            const rejection_reason = rejectionReasons['credit_score_too_low']
                            application.rejection_reasons.push(rejection_reason)
                        }
                        console.log('fico ' + rule.operator + ' ' + rule.value + ' ' + rule_passed)
                    } else if(rule.operator === 'less_than') {
                        if(application.credit_data.fico < rule.value) {
                            rule_passed = true  
                        }
                        console.log('fico ' + rule.operator + ' ' + rule.value + ' ' + rule_passed)
                    } else if(rule.operator === 'equal_to') {
                        if(application.credit_data.fico === rule.value) {
                            rule_passed = true
                        }
                        console.log('fico ' + rule.operator + ' ' + rule.value + ' ' + rule_passed)
                    }
                    break;
                case 'has_bankruptcy_history':
                    console.log('checking has bankruptcy history')
                    if(rule.operator === 'equal_to') {
                        console.log('recognized rule operator as equal to')
                        if(application.credit_data.has_bankruptcy_history === rule.value) {
                            rule_passed = true
                        } else {
                            const rejection_reason = rejectionReasons['has_bankruptcy_history']
                            application.rejection_reasons.push(rejection_reason)
                        }
                        console.log('has bankruptcy history ' + rule.operator + ' ' + rule.value + ' ' + rule_passed)
                    }
                    break;
            
                default:
                    break;
            }
            if(rule_passed) {
                credit_policy_rules_passed++
            }
        }
        console.log('credit policy rules passed')
        console.log(credit_policy_rules_passed)
        console.log('credit policy rules length')
        console.log(credit_policy_rules_length)
        if(credit_policy_rules_passed === credit_policy_rules_length) {
            application.status = 'approved'
            application.offer = offerFields
        } else {
            application.status = 'rejected'
        }
        application.decisioned_on = Date.now();
        await application.save()


        // notify slack
        if(process.env.NODE_ENV === 'production'){
            console.log('running slack script')
            const slack = new WebClient(config.get('slack_bot_id'));
            (async () => {
                try {
                    const greeting = 'A customer application has been underwritten!'
                    const application_id = application.id;
                    const decision = application.status;
                    const credit_data = application.credit_data;
                    const result = slack.chat.postMessage({
                        channel: '#general',
                        text: greeting + '\n' + `*Application:* ${application_id}` +'\n' + `*Decision:* ${decision}` +'\n' + 
                            `*Decision criteria:* ${credit_data}`
                    });
                }
                catch (error) { console.error(error); }
            })();
        }
        
        // respond with application
        application = await Application.findOne({ id: req.params.id })
            .select('-_id -__v -client_id -credit_data');
        console.log(application);
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


// @route PATCH applications/reject
// @desc Reject credit application
// @access Public
router.post('/:id/reject', [auth, rejectionValidationRules()], async (req, res) => {
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

    const rejection_reasons = req.body.rejection_reasons

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

        if(application.status !== "pending") {
            const error = getError("application_cannot_be_rejected")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        application.rejection_reasons = rejection_reasons
        application.status = 'rejected'
        application.decisioned_on = Date.now();
        await application.save()
        application = await Application.findOne({ id: req.params.id })
            .select('-_id -__v -client_id');
        console.log(application);
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

// @route POST applications/id/approve
// @desc Approve credit application
// @access Public
router.post('/:id/approve', [auth, offerValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

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
    offerFields.interest_rate = offer.interest_rate;
    offerFields.late_payment_fee = offer.late_payment_fee;
    offerFields.grace_period = offer.grace_period;
    offerFields.origination_fee = offer.origination_fee;
    offerFields.finance_charge = offer.finance_charge;
    offerFields.term = offer.term;

    if(offer.hasOwnProperty("annual_fee")) {
        offerFields.annual_fee = offer.annual_fee
    }
    if(offer.hasOwnProperty("billing_cycle")) {
        offerFields.billing_cycle = offer.billing_cycle
    }
    if(offer.hasOwnProperty("grace_period_interest_rate")) {
        offerFields.grace_period_interest_rate = offer.grace_period_interest_rate
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
    if(offer.hasOwnProperty("third_party_disbursement_destination")) {
        offerFields.third_party_disbursement_destination = offer.third_party_disbursement_destination
    }


    try {
        let application = await Application.findOne({ id: req.params.id});
        // confirm application exists
        if (!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm application can be approved
        if(application.status !== "pending") {
            const error = getError("application_cannot_be_approved")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // for bnpl confirm that a third party disbursement destination exists
        if(['consumer_bnpl', 'commercial_bnpl'].includes(application.credit_type)) {
            if(!offer.hasOwnProperty("third_party_disbursement_destination")) {
                const error = getError("third_party_missing")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
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

        // grab customer (for checking coverage limit access)
        let customer = await Customer.findOne({client_id: req.client_id });

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
                limit_1.business_types.includes(business_type)) ||
                // type 2
                (
                    offer.amount >= limit_2?.amount.min &&
                    offer.amount <= limit_2?.amount.max &&
                    offer.interest_rate <= limit_2?.max_apr &&
                    limit_2?.business_types.includes(business_type)
                )) {
                    // accept approval if offer meets type 1 or type 2
                    application.offer = offerFields
                    application.status = 'approved'
                    application.decisioned_on = Date.now();
                    await application.save()

                    application = await Application.findOne({ id: req.params.id })
                        .select('-_id -__v -client_id');
                    
                    console.log(application);
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
            console.log(`state: ${consumer.address.state}`)
            if(!(consumer.address.state in consumer_state_limits)) {
                const error = getError("state_not_supported")
                console.log('state not found')
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
                console.log('no pier limits exist');
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } 

            // verify customer is enabled for non-zero interest
            if(offer.interest_rate > 0 && !customer.consumer_non_zero_enabled) {
                const error = getError('non_zero_interest_not_enabled')
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
            
            // verify if offer is compliant for state with moher
            const isOfferCompliant = moher(offer, consumer.address.state)

            // check ssn whitelist for Goodcash. Remove this once CA is live!!!

            // set whitelisted ssn as the first object in list of duuplicate ssn array on customer resource if it exists
            const whitelisted_ssn = customer.duplicate_ssn_whitelist[0] ? customer.duplicate_ssn_whitelist[0] : null

            if(isOfferCompliant || (whitelisted_ssn === '110924648')) {
                // accept approval if offer meets type 1 or type 2
                application.offer = offerFields
                application.status = 'approved'
                application.decisioned_on = Date.now();
                await application.save()
                application = await Application.findOne({ id: req.params.id })
                    .select('-_id -__v -client_id');
                
                console.log(application);
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
    console.log(req.headers)
    console.log(req.body)

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

        console.log(application);
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
    console.log(req.headers)
    console.log(req.body)

    try {

        // Create an initial query object containing the `client_id`
        let query = { client_id: req.client_id };

        // If `borrower_id` is provided, add it to the query object
        if(req.query.borrower_id) {
            query.borrower_id = req.query.borrower_id;
        }
        const applications = await Application.find(query)
            .select('-_id -__v -client_id');
        
        console.log(applications);
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