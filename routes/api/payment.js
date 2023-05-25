const express = require('express');
const auth = require('../../middleware/auth');
const config = require('config');
const router = express.Router();
const Customer = require('../../models/Customer');
const Payment = require('../../models/Payment');
const { getError } = require('../../helpers/errors.js');
const { validationResult } = require('express-validator');
const { paymentValidationRules } = require('../../helpers/validator.js');
const Facility = require('../../models/Facility');
const { v4: uuidv4 } = require('uuid');
const { WebClient } = require('@slack/web-api');
const Consumer = require('../../models/Consumer');
const responseFilters = require('../../helpers/responseFilters.json');
const { addDwollaFundingSource, createDwollaCustomer, 
        submitDwollaPayment, listDwollaCustomers } = require('../../helpers/dwolla.js');
const { dwolla } = require('../../config/default');


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
        var facility = await Facility.findOne({ id: facility_id });
        if(!facility || facility.client_id !== client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // check that customer is enabled for ach
        const customer = await Customer.findOne({ client_id });

        if(!customer.repayment_ach_enabled) {
            const error = getError("repayment_ach_disabled")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }   

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
            bank_routing_number: facility.repayment_bank_details.bank_routing_number,
            bank_account_type: facility.repayment_bank_details.type,
            dwolla_funding_source_id: dwolla_funding_source_id
        })
        
        await payment.save()

        // ping slack for prod payments
        if(process.env.NODE_ENV === 'production' /*|| process.env.NODE_ENV === 'development'*/) {
            const slack = new WebClient(config.get('slack_bot_id'));
            (async () => {
                try {
                    const greeting = 'Bonjour! A payment has been submitted. Submit the transfer to Dwolla 🫡'
                    const result = slack.chat.postMessage({
                        channel: '#payments',
                        text: greeting + '\n' + `*Amount:* $${amount/100}` + '\n' + 
                            `*Status:* ${payment.status}` + '\n' + `*Facility id:* ${facility_id}` + '\n' +
                            `*Payment id:* ${payment_id}` + '\n' +
                            `*Dwolla funding source:* ${dwolla_funding_source_id}`
                            
                    });
                }
                catch (error) { console.error(error); }
            })();
        }
        console.log('successfully created a payment. Facility and payment details below:')
        console.log(facility)
        console.log(payment)
        payment = await Payment.findOne({ id: payment_id })
            .select(responseFilters['payment'] + ' -client_id');
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

// @route     GET payment by id
// @desc      Retrieve a payment's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const payment = await Payment.findOne({ id: req.params.id });
        if(!payment || payment.client_id !== req.client_id) {
            const error = getError("payment_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Response
        let paymentResponse = await Payment.findOne({ id: req.params.id, client_id: req.client_id })
            .select(responseFilters['payment'] + ' -client_id');

        res.json(paymentResponse);

    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_payment_id")
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

// @route     GET payments
// @desc      List all payments
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const payments = await Payment.find({ client_id: req.client_id })
            .select(responseFilters['payment'] + ' -client_id');

        console.log(payments); 
        res.json(payments);

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


////////////////////////
// INTERNAL PRIVATE ROUTES FOR DWOLLA PAYMENTS
////////////////////////


// @route     POST payments/id/submit_to_dwolla
// @desc      Submit payment to dwolla
// @access    Private
router.patch('/:id/submit_to_dwolla', async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // verify admin key
    const { admin_key } = req.body
    if(admin_key !== config.get("pier_admin_key")) {
        return res.status(401).send('Unauthorized')
    }

    // verify facility exists
    var payment = await Payment.findOne({ id: req.params.id });
    if(!payment) {
        return res.status("400").json({
            error_type: "payment_not_found",
            error_code: "payment_not_found",
            error_message: "payment with this id does not exist",
        })
    }

    // block attempt if payment already submitted
    if(payment.status !== "pending") {
        return res.status("400").json({
            error_type: "payment_already_submitted",
            error_code: "payment_already_submitted",
            error_message: "payment with this id has already been submitted to dwolla",
        })
    }

    const dwolla_transfer_id = await submitDwollaPayment(payment)

    if(dwolla_transfer_id === "dwolla_error" || dwolla_transfer_id === "") {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }

    // update payment
    payment.status = "processing"
    payment.dwolla_transfer_id = dwolla_transfer_id
    await payment.save()

    res.json({ message: 'payment submitted to dwolla', payment: payment })

})


module.exports = router;