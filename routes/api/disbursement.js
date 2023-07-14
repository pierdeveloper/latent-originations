const express = require('express');
const auth = require('../../middleware/auth');
const config = require('config');
const router = express.Router({ mergeParams: true });
const Customer = require('../../models/Customer');
const Payment = require('../../models/Payment');
const { getError } = require('../../helpers/errors.js');
const { validationResult } = require('express-validator');
const { paymentValidationRules, disbursementValidationRules } = require('../../helpers/validator.js');
const { encrypt, decrypt } = require('../../helpers/crypto');
const Facility = require('../../models/Facility');
const { v4: uuidv4 } = require('uuid');
const { WebClient } = require('@slack/web-api');
const Consumer = require('../../models/Consumer');
const responseFilters = require('../../helpers/responseFilters.json');
const { addDwollaFundingSource, createDwollaCustomer, 
        submitDwollaPayment, listDwollaCustomers } = require('../../helpers/dwolla.js');
const { dwolla } = require('../../config/default');
const Disbursement = require('../../models/Disbursement');


// @route     POST /facilities/:facility_id/disbursements
// @desc      Create a disbursement for a facility
// @access    Public
router.post('/', [auth, disbursementValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)
    console.log('hit disbursement route')

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
        const facility_id = req.params.facility_id;
        const client_id = req.client_id;
        const { amount, disbursement_bank_account, transfer_type  } = req.body

        // check that facility exists
        var facility = await Facility.findOne({ id: facility_id });
        if(!facility || facility.client_id !== client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // check that customer is enabled for disbursements
        const customer = await Customer.findOne({ client_id });

        if(!customer.disbursement_ach_enabled) {
            const error = getError("disbursement_ach_disabled")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }   

        // calculate sum of existing disbursements for facility
        const existingDisbursements = await Disbursement.find({ facility_id: facility_id });
        var existingDisbursementsSum = 0;
        for (let i = 0; i < existingDisbursements.length; i++) {
            // skip if status is canceled or failed
            if(['canceled', 'failed'].includes(existingDisbursements[i].status)) {
                continue;
            }
            existingDisbursementsSum += existingDisbursements[i].amount;
        }
        // add new disbursement amount
        existingDisbursementsSum += amount;

        // check that disbursement amount is less than facility.terms.amount
        if(existingDisbursementsSum > facility.terms.amount) {
            const error = getError("disbursement_amount_exceeds_facility_amount")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        /*

        // grab borrower details
        var email = ""
        var firstName = ""
        var lastName = ""
        if (['consumer_bnpl', 'consumer_installment_loan', 'consumer_revolving_line_of_credit']
            .includes(facility.credit_type)) {
                const borrowerDetails = await Consumer.findOne({ id: facility.borrower_id })
                var emailPrefix = ""
                if(process.env.NODE_ENV === 'development') {
                    emailPrefix = Math.floor(Math.random() * 9000) + 1000;
                }
                email = emailPrefix + borrowerDetails.email
                firstName = borrowerDetails.first_name
                lastName = borrowerDetails.last_name
        } else { 
            // business
        }

        // if facility doesn't have a dwolla user id, first see if a dwolla user exists with the same email
        if(!facility.dwolla_customer_id) {
            console.log("facility does not have a dwolla customer id")
            const dwollaCustomerList = await listDwollaCustomers();
            console.log(dwollaCustomerList)
            for (let i = 0; i < dwollaCustomerList.length; i++) {
                const customer = dwollaCustomerList[i];
                if(customer.email === email) {
                    // update facility with dwolla customer id
                    console.log('found existing dwolla customer')
                    facility.dwolla_customer_id = customer.id
                    await facility.save()
                    break;
                }
            }
        }

        // now check again if there still isn't a dwolla customer id
        // if not then we need to create a new dwolla customer
        if(!facility.dwolla_customer_id) {
            console.log("dwolla customer id still not found")
            // create dwolla customer
            const dwolla_customer_id = await createDwollaCustomer(firstName, lastName, email)

            // throw error if dwolla customer creation failed
            if(!dwolla_customer_id || dwolla_customer_id === 'dwolla_error') {
                const err_response = {
                    error_type: "PAYMENT_ERROR",
                    error_code: "PAYMENT_ERROR",
                    error_message: "Unable to initiate payment"
                }
                return res.status(400).json(err_response);

            }
            facility.dwolla_customer_id = dwolla_customer_id
            await facility.save()

        }

        console.log(facility)

        // check that facility has repayment bank info
        const bank_details = facility.repayment_bank_details;
        if(!bank_details || 
            !bank_details.bank_account_number ||
            !bank_details.bank_routing_number) {
                const error = getError("missing_repayment_bank_details")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }

        // Set/update/verify funding source id
        const dwolla_funding_source_id = await addDwollaFundingSource(facility);

        // throw error if dwolla funding source creation failed
        if(dwolla_funding_source_id === 'dwolla_error') {
            const err_response = {
                error_type: "PAYMENT_ERROR",
                error_code: "PAYMENT_ERROR",
                error_message: "Unable to initiate payment"
            }
            return res.status(400).json(err_response);
        }
        facility.dwolla_funding_source_id = dwolla_funding_source_id
        await facility.save()
        console.log(facility)

        */
        // create the disbursement id
        const disbursement_id = 'dsb_' + uuidv4().replace(/-/g, '');

        const encrypted_bank_account_number = encrypt(disbursement_bank_account.bank_account_number)

        // Build bank account object
        const disbursement_bank_account_fields = {
            bank_routing_number: disbursement_bank_account.bank_routing_number,
            bank_account_number: encrypted_bank_account_number,
            type: disbursement_bank_account.type
        }

        const disbursement_account = 'svb' // in future link client config to get dwolla/svb/etc

        // create payment resource
        let disbursement = new Disbursement({
            id: disbursement_id,
            facility_id,
            client_id,
            amount,
            transfer_type,
            disbursement_bank_account: disbursement_bank_account_fields,
            disbursement_account
        })
        
        await disbursement.save()

        // ping slack for prod payments
        if(process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
            const slack = new WebClient(config.get('slack_bot_id'));
            (async () => {
                try {
                    const greeting = 'Bonjour! A disbursement has been submitted. Submit the disbursal! 🫡'
                    const result = slack.chat.postMessage({
                        channel: '#payments',
                        text: greeting + '\n' + `*Amount:* $${amount/100}` + '\n' + 
                            `*Status:* ${disbursement.status}` + '\n' + `*Facility id:* ${facility_id}` + '\n' +
                            `*Disbursement id:* ${disbursement_id}` + '\n' 
                            
                    });
                }
                catch (error) { console.error(error); }
            })();
        }
        console.log('successfully created a disbursement. Facility and disbursement details below:')
        console.log(facility)
        console.log(disbursement)
        disbursement = await Disbursement.findOne({ id: disbursement_id })
            .select(responseFilters['disbursement'] + ' -client_id');
        res.json(disbursement);

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

// @route     GET /facilities/:facility_id/disbursements/id
// @desc      Get disbursements by id
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const disbursement = await Disbursement.findOne({ id: req.params.id });
        if(!disbursement || disbursement.client_id !== req.client_id) {
            const error = getError("disbursement_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Response
        let disbursementResponse = await Disbursement.findOne({ id: req.params.id, client_id: req.client_id })
            .select(responseFilters['disbursement'] + ' -client_id');

        res.json(disbursementResponse);

    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_disbursement_id")
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
});

// @route     GET disbursements
// @desc      List all disbursements for a facility
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)
    console.log('list all disbursements for a facility route hit')

    try {
        const disbursements = await Disbursement.find({ client_id: req.client_id, facility_id: req.params.facility_id })
            .select(responseFilters['disbursement'] + ' -client_id');

        console.log(disbursements); 
        res.json(disbursements);

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