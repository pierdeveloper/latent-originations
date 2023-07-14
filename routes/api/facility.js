const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const { encrypt, decrypt } = require('../../helpers/crypto');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Application = require('../../models/Application');
const Facility = require('../../models/Facility');
const Job = require('../../models/Job');
const { calculate_periodic_payment } = require('../../helpers/docspring.js');
const { validationResult } = require('express-validator');
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const valid_rejection_reasons = require('../../helpers/rejectionReasons.json');
const moment = require('moment');
const { createNLSConsumer, createNLSLoan, retrieveNLSLoan, createNLSLineOfCredit, syncFacilityWithNLS } = require('../../helpers/nls.js');
const axios = require('axios');
const config = require('config');
const responseFilters = require('../../helpers/responseFilters.json');
const { response } = require('express');
const { bankDetailsValidationRules, autopayValidationRules } = require('../../helpers/validator.js');
const { WebClient } = require('@slack/web-api');
const Statement = require('../../models/Statement.js');
const pierFormats = require('../../helpers/formats.js');
const {createFacility} = require('../../helpers/facilities.js');
const Disbursement = require('../../models/Disbursement.js');



// @route     POST facility
// @desc      Create a credit facility
// @access    Public
// WARNING: facility create assumes a consumer installment loan. Will not support other credit/borrower types!!
router.post('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    const client_id = req.client_id
    const { loan_agreement_id } = req.body
    const facility = await createFacility(loan_agreement_id, client_id, false)
    // Response
    // if response has a key name error, return error
    if(facility.error) {
        const err = facility.error
        return res.status(err.error_status).json({
            error_type: err.error_type,
            error_code: err.error_code,
            error_message: err.error_message
        })
    } else {
        res.json(facility);
    }

    /*
    try {
        // pull up the loan agreement
        let loan_agreement = await Document.findOne({ id: loan_agreement_id });

        // verify it exists
        if(!loan_agreement || loan_agreement.client_id !== client_id) {
            const error = getError("document_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm loan_agreement status is SIGNED
        if(loan_agreement.status !== 'signed') {
            const error = getError("facility_cannot_be_created")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Confirm a facility for this loan agreement does not already exist (ignore for dev)
        if(process.env.NODE_ENV !== 'development') {
            let existingFacility = await Facility
                .findOne({ loan_agreement_id: loan_agreement.id });
            if(existingFacility) {
                const error = getError("facility_already_exists")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
        }

        // Pull up relevant application
        let application = await Application.findOne({ id: loan_agreement.application_id })

        // Only allow supported products
        if(!['consumer_bnpl', 'consumer_revolving_line_of_credit', 'consumer_installment_loan', 'commercial_net_terms'].includes(application.credit_type)) {
            const error = getError("unsupported_product")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Get portfolio id from client resource
        const client = await Customer.findOne({client_id});
        const nls_group_name = client.nls_group_name;
    

        // Pull up relevant borrower
        const borrower = await Borrower.findOne({ id: application.borrower_id })

        // Get borrower details based on type
        var borrowerDetails = {}
        if(borrower.type === 'business') {
            borrowerDetails = await Business.findOne({ id: borrower.id}) 
        } else {
            borrowerDetails = await Consumer.findOne({ id: borrower.id})  
        }

        // base facility params
        var facility = {}
        var facilityFields = {}
        facilityFields.application_id = application.id;
        facilityFields.borrower_id = borrower.id;
        facilityFields.credit_type = application.credit_type;
        facilityFields.facility_id = 'fac_' + uuidv4().replace(/-/g, '');
        facilityFields.account_number = Math.floor(Math.random() * 900000000) + 100000000;
        facilityFields.autopay_enabled = false
        const format = pierFormats.shortDate
        console.log('pier date format: ' + format)
        facilityFields.origination_date = moment(loan_agreement.signature_timestamp).format(pierFormats.shortDate)
        if(!nls_group_name || nls_group_name === "") {
            facilityFields.nls_group_name = "DEFAULT"
        } else { facilityFields.nls_group_name = nls_group_name}
        // set facility.
        

        
        // Build facility object based on credit type
        switch (facilityFields.credit_type) {
            case "consumer_bnpl":
            case "consumer_installment_loan":              
                facilityFields.disbursement_date = facilityFields.origination_date;
                facilityFields.remaining_term = application.offer.term;            
                break;

            case "consumer_revolving_line_of_credit":
                facilityFields.disbursement_date = null
                break
        
            default:
                break;
        }
        
        const cif_number = borrowerDetails.cif_number 
        ? borrowerDetails.cif_number 
        : application.credit_type = 'commercial_net_terms' 
            ? borrowerDetails.beneficial_owners[0].cif_number
            : null

        
        // create facility
        facility = new Facility({
            id: facilityFields.facility_id,
            application_id: facilityFields.application_id,
            borrower_id: facilityFields.borrower_id,
            cif_number: cif_number,
            loan_agreement_id: loan_agreement_id,
            client_id,
            account_number: facilityFields.account_number,
            credit_type: facilityFields.credit_type,
            terms: application.offer,
            origination_date: facilityFields.origination_date,
            disbursement_date: facilityFields.disbursement_date,
            balance: facilityFields.balance,
            nls_group_name: facilityFields.nls_group_name,
            autopay_enabled: facilityFields.autopay_enabled,
            remaining_term: facilityFields.remaining_term,
        })
        
        if(facilityFields.credit_type === 'commercial_net_terms') {
            facility.balance = application.offer.amount
        }
        
        // Create the NLS Loan based on credit type
        switch (facilityFields.credit_type) {
            case "commercial_net_terms":
            case "consumer_installment_loan":
            case "consumer_bnpl":
                const nls_loan = await createNLSLoan(facility);
                if(nls_loan === 'nls_error') {
                    console.log('error creating loan in nls');
                    throw new Error("NLS Error");
                }
                facility.nls_account_ref = nls_loan.nls_account_ref;
                
                break;

            case "consumer_revolving_line_of_credit":
                const nls_line_of_credit = await createNLSLineOfCredit(facility);
                if(nls_line_of_credit === 'nls_error') {
                    console.log('error creating line of credit in nls');
                    throw new Error("NLS Error");
                }
                facility.nls_account_ref = nls_line_of_credit.nls_account_ref;
                break;
            default: break;
        }

        // Sync facility with NLS details
        const syncJob = await syncFacilityWithNLS(facility);
        if(syncJob !== 'SUCCESS') {
            console.log('error syncing facility with nls');
            throw new Error("NLS Sync Error");
        }

        // Add Dwolla user to facility

        // ping slack for prod facilities
        if(process.env.NODE_ENV === 'production'){
            console.log('running slack script')
            const slack = new WebClient(config.get('slack_bot_id'));
            (async () => {
                try {
                    const greeting = '💰 A new loan has been originated! 💰'
                    const customer = facility.nls_group_name;
                    const loan_type = facility.credit_type;
                    const amount = facility.terms.amount;
                    const state = borrowerDetails.address.state;
                    const result = slack.chat.postMessage({
                        channel: '#general',
                        text: greeting + '\n' + `*Customer:* ${customer}` +'\n' + `*Type:* ${loan_type}` +'\n' + 
                            `*Amount:* $${amount/100}` + '\n' + `*State:* ${state}` +'\n' + `*Account #:* ${facility.account_number}`
                    });
                }
                catch (error) { console.error(error); }
            })();
        }

        // Response
        let facilityResponse = await Facility.findOne({ id: facility.id, client_id })
            .select(responseFilters['facility'] + ' -client_id');
        console.log(facilityResponse); 
        res.json(facilityResponse);
        
    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }*/
    
});



// @route POST facility/{id}/repayment_bank_details
// @desc Add bank account and routing number for repayment to facility
// @access Public
router.post('/:id/repayment_bank_details', [auth, bankDetailsValidationRules()], async (req, res) => {
    console.log(req.headers);
    console.log(req.body); 

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

    const {
        bank_routing_number,
        bank_account_number,
        type
    } = req.body

    try {
        // verify facility exists
        let facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        console.log(facility);
        // TODO: encrypt bank account number
        const encrypted_bank_account_number = encrypt(bank_account_number)

        // Build bank account object
        const bank_account = {
            bank_routing_number,
            bank_account_number: encrypted_bank_account_number,
            type
        }
        
        // Set repayment bank details
        facility.repayment_bank_details = bank_account;

        // Save and respond
        await facility.save();

        facility = await Facility.findOne({ id: req.params.id })
            .select(responseFilters['facility'] + ' -client_id');
        
        facility.repayment_bank_details.bank_account_number = decrypt(facility.repayment_bank_details.bank_account_number)
        
        console.log(facility);
        res.json(facility)

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

// @route POST facility/{id}/enable_autopay
// @desc Enable autopay for a facility
// @access Public
router.post('/:id/enable_autopay', [auth, autopayValidationRules()], async (req, res) => {
    console.log(req.headers);
    console.log(req.body); 

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

    const {
        bank_account,
        additional_amount,
    } = req.body

    try {
        // verify facility exists
        let facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        console.log(facility);
        // TODO: encrypt bank account number
        const encrypted_bank_account_number = encrypt(bank_account.bank_account_number)

        // Build bank account object
        const bank_account_fields = {
            bank_routing_number: bank_account.bank_routing_number,
            bank_account_number: encrypted_bank_account_number,
            type: bank_account.type
        }

        // Build autopay object
        const autopay_fields = {
            additional_amount,
            authorized: true,
            authorization_timestamp: new Date(),
            bank_account: bank_account_fields
        }
        
        // Set repayment bank details
        facility.autopay = autopay_fields;


        // Save and respond
        await facility.save();

        facility = await Facility.findOne({ id: req.params.id })
            .select(responseFilters['facility'] + ' -client_id');
        
        facility.autopay.bank_account.bank_account_number = decrypt(facility.autopay.bank_account.bank_account_number)
        
        console.log(facility);
        res.json(facility)

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

// @route POST facility/{id}/disable_autopay
// @desc Enable autopay for a facility
// @access Public
router.post('/:id/disable_autopay', [auth], async (req, res) => {
    console.log(req.headers);
    console.log(req.body); 

    try {
        // verify facility exists
        let facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        console.log(facility);

        // check that autopay is enabled
        if(!facility.autopay?.authorized) {
            const error = getError("autopay_already_disabled")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // disable autopay
        facility.autopay = undefined;
        
        // Save and respond
        await facility.save();

        facility = await Facility.findOne({ id: req.params.id })
            .select(responseFilters['facility'] + ' -client_id');
        
        console.log(facility);
        res.json(facility)

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


// @route POST facility/close
// @desc Close a facility
// @access Public
router.post('/:id/close', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        let facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        if(facility.status === "closed") {
            const error = getError("facility_cannot_be_closed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        facility.status = 'closed'
       
        await facility.save()
        facility = await Facility.findOne({ id: req.params.id })
            .select(responseFilters['facility'] + ' -client_id');
        
        console.log(facility); 
        res.json(facility)

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

// @route     GET disbursements for all facilities
// @desc      List all disbursements
// @access    Public
router.get('/disbursements', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const disbursements = await Disbursement.find({ client_id: req.client_id })
            .select(responseFilters['disbursement'] + ' -client_id');
        // Response
        res.json(disbursements);

    } catch(err) {
        console.error(err.message);
        
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})


// @route     GET facility by id
// @desc      Retrieve an facility's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)
    console.log('get facility by id route hit')

    try {
        const facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Response
        let facilityResponse = await Facility.findOne({ id: facility.id, client_id: req.client_id })
            .select(responseFilters['facility'] + ' -client_id');

        if(facilityResponse.repayment_bank_details?.bank_account_number) {
            facilityResponse.repayment_bank_details.bank_account_number = decrypt(facilityResponse.repayment_bank_details.bank_account_number)
        }
        res.json(facilityResponse);

    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_facility_id")
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

// @route     GET facilities
// @desc      List all facilities
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const facilities = await Facility.find({ client_id: req.client_id })
            .select(responseFilters['facility'] + ' -client_id');
        
        // loop through facilities and decrypt each bank account number in repayment bank details
        for(let i = 0; i < facilities.length; i++) {
            if(facilities[i].repayment_bank_details) {
                if(facilities[i].repayment_bank_details.bank_account_number) {
                    if(facilities[i].repayment_bank_details.bank_account_number.length < 30) {
                        continue; // skip existing unencrypted numbers
                    } else {
                        facilities[i].repayment_bank_details.bank_account_number = decrypt(facilities[i].repayment_bank_details.bank_account_number)
                    } 
                }
            }
        }

        console.log(facilities); 
        res.json(facilities);

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

// @route     GET statements for a facility
// @desc      List all facilities for a facility
// @access    Public
router.get('/:id/statements', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const facility = await Facility.findOne({ id: req.params.id });
        if(!facility || facility.client_id !== req.client_id) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        const statements = await Statement.find({ facility_id: facility.id })
            .select(responseFilters['statement'] + ' -client_id');
        // Response
        res.json(statements);

    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_facility_id")
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



////////////////////////
// INTERNAL PRIVATE ROUTES FOR SYNCING WITH NLS
////////////////////////


// @route     PATCH facilities/id/synchronize
// @desc      Sync facility with NLS
// @access    Private
router.patch('/:id/synchronize', async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // verify admin key
    const { admin_key } = req.body
    if(admin_key !== config.get("pier_admin_key")) {
        return res.status(401).send('Unauthorized')
    }

    // verify facility exists
    var facility = await Facility.findOne({ id: req.params.id });
    if(!facility) {
        const error = getError("facility_not_found")
        return res.status(error.error_status).json({
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }

    const syncJob = await syncFacilityWithNLS(facility);

    if(syncJob !== "SUCCESS") {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }

    res.json({ message: 'facility sync complete' })

})



// @route     PATCH facilities/synchronize
// @desc      Sync all facilities with NLS
// @access    Private
router.patch('/synchronize', async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // verify admin key
    const { admin_key } = req.body
    if(admin_key !== config.get("pier_admin_key")) {
        return res.status(401).send('Unauthorized')
    }

    runNLSSynchroJob()

    res.json({msg: 'started nls synchro job'})

    

})

const runNLSSynchroJob = async () => {
    const time_initiated = moment()
    var time_completed = moment()
    var status = 'failed'
    const errorsList = [];
    const skipped = [];
    var facilities = [];
    var sync_count = 0;

    try {

        // grab all facilities
        facilities = await Facility.find();
        
        // loop thru each facility
        for (let i = 0; i < facilities.length; i++) {

            var facility = facilities[i]
            console.log(facility);
            if(!facility.nls_account_ref) {
                console.log('facility not setup in NLS. Skipping it')
                skipped.push(facility.facility_id);
                continue;
            }

            const syncJob = await syncFacilityWithNLS(facility)

            if(syncJob !== "SUCCESS") {
                errorsList.push(facility.facility_id)
            } else {
                sync_count++;
            }

            // latency to avoid nls rate limit
            var waitTill = new Date(new Date().getTime() + 1 * 250);
            while(waitTill > new Date()){}
            
        }

        time_completed = moment();
        status = 'completed'
        console.log('loop job complete')

    } catch (err) {
        time_completed = moment();
        console.log({error: 'critical error syncing facilities with NLS'})
    }   

    // report the job
    const duration = moment.duration(time_completed.diff(time_initiated)).asSeconds()
    const jobReport = new Job({
        facility_count: facilities.length,
        sync_count: sync_count,
        skipped: skipped,
        errorsList: errorsList,
        time_initiated: time_initiated,
        time_completed: time_completed,
        type: 'fax',
        env: process.env.NODE_ENV,
        status: status,
        duration: duration
    })
    jobReport.save();
    console.log(jobReport);

    // ping slack for prod and sandbox facilities
    if(process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'sandbox') {
        console.log('running slack script')
        const slack = new WebClient(config.get('slack_bot_id'));
        (async () => {
            try {
                const greeting = '🔄 A cron job has finished running 🔄'
                const result = slack.chat.postMessage({
                    channel: '#crons',
                    text: greeting + '\n' + '\n' + `*Type:* Fax` +'\n' + `*Env:* ${process.env.NODE_ENV}` +'\n' + 
                        `*Status:* ${status}` + '\n' + `*Facility count:* ${facilities.length}` +'\n' + `*Sync count:* ${sync_count}`
                        + '\n' + `*Skipped:* ${skipped}` +'\n' + `*Errors:* ${errorsList}`
                        + '\n' + `*Time initiated:* ${time_initiated}` +'\n' + `*Time completed:* ${time_completed}`
                        + '\n' + `*Duration:* ${duration}`
                });
            }
            catch (error) { console.error(error); }
        })();
    }

}








// NLS UTILITY FUNCTIONS FOR TESTING

router.post('/generate_token', [auth], async (req, res) => {
    const CLIENT_ID = '08876T';
    const CLIENT_SECRET = 'x7DbV!qa^';
    const USERNAME = 'PLREST8876';
    const PASSWORD = 'prV%h6e@q';
    const SCOPE = 'openid api server:rnn1-nls-sqlt04.nls.nortridge.tech db:Pier_Lending_Test'
    
    const url = 'https://auth.nortridgehosting.com/25.0/core/connect/token';

    const header = {'content-type': 'application/x-www-form-urlencoded'}

    let payload = {
        grant_type: 'password',
        username: USERNAME,
        password: PASSWORD,
        scope: SCOPE,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
    }

    
        console.log("FETCHING TOKEN!!!!!")
        let response = await axios.post(url, payload, {headers: header})
        console.log(response.data);
        const accessToken = response.data.access_token;
        const bearerToken = 'Bearer ' + accessToken;
        console.log('Bearer token:', bearerToken);
        
        res.json(response.data)
    
    
})

router.post('/revoke_token/:token', [auth], async (req, res) => {

    const token = req.params.token

    /////
    const CLIENT_ID = '08876T';
    const CLIENT_SECRET = 'x7DbV!qa^';
    const USERNAME = 'PLREST8876';
    const PASSWORD = 'prV%h6e@q';
    const SCOPE = 'openid api server:rnn1-nls-sqlt04.nls.nortridge.tech db:Pier_Lending_Test'
    
    const url = 'https://auth.nortridgehosting.com/25.0/core/connect/revocation';

    const auth = 'Basic ' + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString('base64');
    const header = {'content-type': 'application/x-www-form-urlencoded', 'Authorization': auth}

    let payload = {
        token: token.toString(),
        token_type_hint: 'access_token'
    }

    console.log("Revoking token..")
    let response = await axios.post(url, payload, {headers: header})
    console.log(response.data);

    res.json(response.data)

    
})

router.get('/version/:token', [auth], async (req, res) => {
    const token = req.params.token
    const url = 'https://api.nortridgehosting.com/25.0/version';

    const auth = 'Bearer ' + token;
    const header = {'content-type': 'application/json', 'Authorization': auth}
    let response = await axios.get(url, {headers: header})
    res.json(response.data);
})

router.get('/loans/:id', [auth], async (req, res) => {
    const {nls_auth_token} = req.body
    const loan_id = "2"
    const url = `https://api.nortridgehosting.com/25.0/loans/${loan_id}?test=false`;

    const auth = 'Bearer ' + nls_auth_token;
    const header = {'content-type': 'application/json', 'Authorization': auth}

    let response = await axios.get(url, {headers: header})
    res.json(response.data);
})

router.post('/nls_users', [auth], async (req, res) => {
    const token = await generateNLSAuthToken();
    console.log(`token generated: ${token}`)

    const url = `https://api.nortridgehosting.com/25.0/nls/xml-import?test=false`;

    const auth = 'Bearer ' + token;
    const header = {'Content-Type': 'application/xml', 'Accept': 'application/json',
     'Authorization': auth}
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
        <NLS CommitBlock="1" EnforceTagExistence="1">
        <CIF 
            UpdateFlag="0"
            CIFNumber="999"
            Entity="Individual"
            CIFPortfolioName="&lt;default&gt;" 
            ShortName="Randy Maven"
            FirstName1="Randy"
            LastName1="Maven"
        >
        </CIF>
        </NLS>
    `
    await axios.post(url, xmlData, {headers: header})
    .then((response) => {
        console.log('successfully created nls consumer user')
        console.log(response.data);
      })
    .catch((error) => {
        console.log('error trying to create nls consumer')
        console.log(error.response.data);
    });

    await revokeNLSAuthToken(token);
})




module.exports = router;