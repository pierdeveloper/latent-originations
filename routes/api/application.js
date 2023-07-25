const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const {Application, LoanOffer, LineOfCreditOffer} = require('../../models/Application');
const { validationResult } = require('express-validator');
const { applicationValidationRules, 
        offerValidationRules,
        loanOfferValidationRules,
        locOfferValidationRules,
        rejectionValidationRules, 
        loanOffersListValidationRules,
        locOffersListValidationRules,
        customerValidationRules,
        arrayOfOffersRules,
        offersListRules,
        } = require('../../helpers/validator.js');
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
const { calculateAPR } = require('../../helpers/nls.js');
const { calculate_periodic_payment } = require('../../helpers/docspring.js');
const { off } = require('../../models/Customer.js');
const { json } = require('body-parser');

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
                'commercial_installment_loan', 'commercial_merchant_advance'].includes(credit_type))
        ) {
            console.log('credit type cant be made for this borrower type')
            const error = getError("application_cannot_be_created")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // if 3rd party disbursement destination is not provided and client id is not xxx retrn error
        if(credit_type === 'consumer_bnpl'
            && !third_party_disbursement_destination 
            && client_id !== 'eca6a64850e2417baeb5ed47ad6b7ad3' /* marley exception */) {
            const error = getError("third_party_missing")
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
        if(credit_type === 'commercial_merchant_advance') { applicationFields.lender_of_record = ""}
        if(third_party_disbursement_destination) applicationFields.third_party_disbursement_destination = third_party_disbursement_destination;
        let application = new Application(applicationFields);
        await application.save()

        // resopnd with application
        application = await Application.findOne({ id: application_id })
            .select('-_id -__v -client_id');
        //if(application.credit_type === 'commercial_merchant_advance') { application.lender_of_record = undefined}
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

    // get client config
    const customer = await Customer.findOne({ client_id: req.client_id })
    const client_id = customer.client_id
    
    // require underwriting enabled for production
    if(process.env.NODE_ENV !== 'development' && !customer.underwriting_enabled) {
        const error = getError("unsupported_product")
        return res.status(error.error_status).json({
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }

    const { offer, offers } = req.body

    // build offer object
    const offersList = [];
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
    } else { offerFields.repayment_frequency = "monthly" }
    if(offer.hasOwnProperty("third_party_disbursement_destination")) {
        offerFields.third_party_disbursement_destination = offer.third_party_disbursement_destination
    }

    // create offer id
    offerFields.id = 'off_' + uuidv4().replace(/-/g, '');
    console.log(`offer fields: ${JSON.stringify(offerFields)}`)


    try {
        // pull in application
        var application = await Application.findOne({ id: req.params.id});
        if(client_id === "eca6a64850e2417baeb5ed47ad6b7ad3") {
            application.third_party_disbursement_destination = offerFields.third_party_disbursement_destination
        }

        // if line of credit create lineofcreditoffer
        if (application.credit_type === 'consumer_revolving_line_of_credit') {
            const lineOfCreditOffer = new LineOfCreditOffer(offerFields)
            lineOfCreditOffer.grace_period = { term: offerFields.grace_period, interest_rate: offerFields.grace_period_interest_rate }
            offersList.push(lineOfCreditOffer)

        } else { // else create loanoffer
            const loanOffer = new LoanOffer(offerFields)
            const term_type = offerFields.repayment_frequency === "monthly" ? "months" : "payments"
            loanOffer.loan_term = { term: offerFields.term, term_type: term_type }
            loanOffer.grace_period = { term: offerFields.grace_period, interest_rate: offerFields.grace_period_interest_rate }
            loanOffer.payment_period = offerFields.repayment_frequency
            offersList.push(loanOffer)
        }  
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


        // calculate periodic payment and apr if credit type is consumer_bnpl or consumer_installment_loan
        if(application.credit_type === 'consumer_bnpl' || application.credit_type === 'consumer_installment_loan') {
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
            offerFields.periodic_payment = periodic_payment_amount;
            offer.periodic_payment = periodic_payment_amount;
            offersList[0].periodic_payment = periodic_payment_amount;

            console.log('periodic payment amount: ', periodic_payment_amount)
            // calc offer
            var apr = await calculateAPR(offer, periodic_payment_amount);
            console.log('APR: ', apr)
            
            offerFields.apr = apr;
            offer.apr = apr
            offersList[0].apr = apr;
        } else if (application.credit_type === 'consumer_revolving_line_of_credit') {
            offer.apr = offer.interest_rate
            offersList[0].apr = offer.interest_rate
        }

        
        
        const isOfferCompliant = moher(offer, consumer.address.state)

        // check type 1
        if(isOfferCompliant) {
            // accept approval if offer meets type 1 or type 2
            console.log('offer limits are valid! time to underwrite..')

        } else {
            // otherwise reject
            console.log('offer limits are not valid')
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
            offersList.forEach(async offer => {
                switch (application.credit_type) {
                    case 'consumer_revolving_line_of_credit':
                        const locOffer = new LineOfCreditOffer(offer)
                        await locOffer.save()
                        break;
                    case 'consumer_installment_loan':
                    case 'consumer_bnpl':
                        const loanOffer = new LoanOffer(offer)
                        await loanOffer.save()
                        break;
                    default:
                        break;
                }
            })
            
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

const applyOfferValidationRules = async (req, res, next) => {
    // in the future, check application type and customer config to determine which rules to apply
    const customer = await Customer.findOne({ client_id: req.client_id })
    console.log(`customer client id is ${customer.client_id}`)
    console.log(`request client id is ${req.client_id}`)
    const use_single_offer = customer.legacy_single_application_offer_supported ? true : false
    console.log('this customer profiles single offer support is ' + use_single_offer)
    const application = await Application.findOne({ id: req.params.id })
    if(!application) {
        const error = getError("application_not_found")
        return res.status(error.error_status).json({
            error_type: error.error_type,
            error_code: error.error_code,   
            error_message: error.error_message
        })
    }
    let rules = []
    if(use_single_offer) {
        switch (application.credit_type) {
            case 'consumer_installment_loan':
            case 'consumer_bnpl':
                rules = [...rules, ...offerValidationRules()]
                break;
            case 'consumer_revolving_line_of_credit':
                console.log('applying loc offer rules!!')
                rules = [...rules, ...locOfferValidationRules()]
                break;
            default:
                break;
        }
    } else {
        switch (application.credit_type) {
            case 'consumer_bnpl':
            case 'consumer_installment_loan':
                console.log('adding loan offers list validation rules!')
                rules = [...rules, ...loanOffersListValidationRules()]
                break;
            case 'consumer_revolving_line_of_credit':
                console.log('applying loc offer rules!!')
                rules = [...rules, ...locOffersListValidationRules()]
                break;
            default:
                break;
        }
    }
    /*
    if (req.body.offer) {
      // if email exists in the request, apply ruleOne
      rules = [...rules, ...offerValidationRules()]
    } 

    if (req.body.offers) {
      // if age exists in the request, apply ruleTwo
      rules = [...rules, ...offersListRules()]
    }
    */
    let i = 0;
    const runNextRule = () => {
        if (i < rules.length) {
          rules[i](req, res, runNextRule);
          i += 1;
        } else {
          next();
        }
      };
    
      runNextRule();
  }

// @route POST applications/id/approve
// @desc Approve credit application
// @access Public
router.post('/:id/approve', [auth, applyOfferValidationRules], async (req, res) => {
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

    const { offer, // legacy paramam
            offers 
        } = req.body

    const offersList = []
    
    // legacy offer components
    const offerFields = {}; 
    console.log('inside our main function')

    try {
        var application = await Application.findOne({ id: req.params.id});
        console.log(application)
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
        let customer = await Customer.findOne({ client_id: req.client_id })
        const use_single_offer_param = customer.legacy_single_application_offer_supported

        // if using legacy single offer, validate offer params, create Offer and push to offers list
        if (use_single_offer_param) {     

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
                offerFields.payment_period = offer.repayment_frequency
            } else { offerFields.repayment_frequency = "monthly" }
            if(offer.hasOwnProperty("third_party_disbursement_destination")) {
                offerFields.third_party_disbursement_destination = offer.third_party_disbursement_destination
            }
            if(offer.hasOwnProperty("first_payment_date")) {
                offerFields.first_payment_date = offer.first_payment_date
            }

            // create offer id
            offerFields.id = 'off_' + uuidv4().replace(/-/g, '');
            console.log(`offer fields: ${JSON.stringify(offerFields)}`)

            // if line of credit create lineofcreditoffer
            if (application.credit_type === 'consumer_revolving_line_of_credit') {
                const lineOfCreditOffer = new LineOfCreditOffer(offerFields)
                lineOfCreditOffer.grace_period = { term: offerFields.grace_period, interest_rate: offerFields.grace_period_interest_rate }
                offersList.push(lineOfCreditOffer)

            } else { // else create loanoffer
                const loanOffer = new LoanOffer(offerFields)
                const term_type = offerFields.repayment_frequency === "monthly" ? "months" : "payments"
                loanOffer.loan_term = { term: offerFields.term, term_type: term_type }
                loanOffer.grace_period = { term: offerFields.grace_period, interest_rate: offerFields.grace_period_interest_rate }
                loanOffer.payment_period = offerFields.repayment_frequency
                offersList.push(loanOffer)
            }       
        } else {

            offers.forEach(offer => {
                offer.id = 'off_' + uuidv4().replace(/-/g, '');
                switch (application.credit_type) {
                    case 'consumer_revolving_line_of_credit':
                        const lineOfCreditOffer = new LineOfCreditOffer(offer)
                        offersList.push(lineOfCreditOffer)
                        break;
                    case 'consumer_installment_loan':
                    case 'consumer_bnpl':
                        const loanOffer = new LoanOffer(offer)
                        offersList.push(loanOffer)
                    default:
                        break;
                }
            })
        }

        console.log(offersList)

        // compliance checks
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
            const offer = offersList[0]
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
                    offerFields.repayment_frequency = undefined
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
            
            // if it's consumer then
            } else {
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

            offersList.forEach(offer => {
                if(offer.interest_rate > 0 && !customer.consumer_non_zero_enabled) {
                    const error = getError('non_zero_interest_not_enabled')
                    return res.status(error.error_status).json({
                        error_type: error.error_type,
                        error_code: error.error_code,
                        error_message: error.error_message
                    })
                }
            })


            // calculate periodic payment and apr if credit type is consumer_bnpl or consumer_installment_loan
            if(application.credit_type === 'consumer_bnpl' || application.credit_type === 'consumer_installment_loan') {
                for(let i = 0; i < offersList.length; i++) {
                    const offer = offersList[i];
                    // calc loan amount
                    const loan_amount = offer.amount / 100;
                    //const disbursement_amount = loan_amount - origination_fee_amount / 100;
                    const payment_period = offer.payment_period;
                    // calc payments per year
                    const payments_per_year = payment_period === 'monthly' ? 12
                        : payment_period === 'biweekly' ? 26
                        : payment_period === 'semi_monthly' ? 24
                        : payment_period === 'semi_monthly_14' ? 24
                        : payment_period === 'semi_monthly_first_15th' ? 24
                        : payment_period === 'semi_monthly_last_15th' ? 24
                        : payment_period === 'weekly' ? 52
                        : 24;

                    // calc periodic payment amount
                    const periodic_payment_amount = calculate_periodic_payment(
                        loan_amount,
                        offer.loan_term.term,
                        payments_per_year,
                        offer.interest_rate / 10000
                    );
                    offer.periodic_payment = periodic_payment_amount;

                    console.log('periodic payment amount: ', periodic_payment_amount)
                    // calc offer
                    var apr = await calculateAPR(offer, periodic_payment_amount);
                    console.log('APR: ', apr)
                    offer.apr = apr
                    if(use_single_offer_param) {
                        offerFields.apr = apr
                        offerFields.periodic_payment = periodic_payment_amount
                    }
                }
            } else if (application.credit_type === 'consumer_revolving_line_of_credit') {
                for(let i = 0; i < offersList.length; i++) {
                    const offer = offersList[i];
                    offer.apr = offer.interest_rate
                    if(use_single_offer_param) {
                        offerFields.apr = offer.interest_rate
                    }
                }
            }      
            
            // verify if offer is compliant for state with moher
            const areAllOffersCompliant = offersList.every(offer => moher(offer, consumer.address.state))
            console.log(`areAllOffersCompliant: ${areAllOffersCompliant}`)
            //const isOfferCompliant = moher(offer, consumer.address.state)

            // check ssn whitelist for Goodcash. Remove this once CA is live!!!
            // set whitelisted ssn as the first object in list of duuplicate ssn array on customer resource if it exists
            const whitelisted_ssn = customer.duplicate_ssn_whitelist[0] ? customer.duplicate_ssn_whitelist[0] : null

            console.log(`whitelisted_ssn: ${whitelisted_ssn}`)
            console.log(`application.credit_type: ${application.credit_type}`)

            if(areAllOffersCompliant || 
                // temp whitelist for good cash prod testing
                (whitelisted_ssn === '110924648' && application.credit_type === 'consumer_revolving_line_of_credit')) {
                // accept approval if offer meets type 1 or type 2
                if(use_single_offer_param) {
                    console.log(`offer fields: ${JSON.stringify(offerFields)}`)
                    application.offer = offerFields
                } 
                

                // save offers
                offersList.forEach(async offer => {
                    switch (application.credit_type) {
                        case 'consumer_revolving_line_of_credit':
                            const locOffer = new LineOfCreditOffer(offer)
                            await locOffer.save()
                            break;
                        case 'consumer_installment_loan':
                        case 'consumer_bnpl':
                            const loanOffer = new LoanOffer(offer)
                            await loanOffer.save()
                            break;
                        default:
                            break;
                    }
                })

                application.offers = offersList
                application.status = 'approved'
                application.decisioned_on = Date.now();
                
                // save application and respond
                await application.save()
                application = await Application.findOne({ id: application.id })
                    .select('-_id -__v -client_id');
                
                
                console.log(application);
                // save all offers from offersList to offer collection

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
    }
    catch(err) {
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