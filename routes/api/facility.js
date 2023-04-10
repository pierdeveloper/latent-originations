const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Application = require('../../models/Application');
const Facility = require('../../models/Facility');
const { calculate_periodic_payment } = require('../../helpers/docspring.js');
const { validationResult } = require('express-validator');
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const valid_rejection_reasons = require('../../helpers/rejectionReasons.json');
const moment = require('moment');
const { createNLSConsumer, createNLSLoan, retrieveNLSLoan, createNLSLineOfCredit } = require('../../helpers/nls.js');
const axios = require('axios');
const config = require('config');
const responseFilters = require('../../helpers/responseFilters.json');
const { response } = require('express');
const { bankDetailsValidationRules } = require('../../helpers/validator.js');
const { WebClient } = require('@slack/web-api');



// @route     POST facility
// @desc      Create a credit facility
// @access    Public
// WARNING: facility create assumes a consumer installment loan. Will not support other credit/borrower types!!
router.post('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    const client_id = req.client_id
    const { loan_agreement_id } = req.body

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
        if(!['consumer_bnpl', 'consumer_revolving_line_of_credit', 'consumer_installment_loan'].includes(application.credit_type)) {
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
        facilityFields.origination_date = moment(loan_agreement.signature_timestamp).format("YYYY/MM/DD");
        if(!nls_group_name || nls_group_name === "") {
            facilityFields.nls_group_name = "DEFAULT"
        } else { facilityFields.nls_group_name = nls_group_name}
        

        
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
        
        
        // create facility
        facility = new Facility({
            id: facilityFields.facility_id,
            application_id: facilityFields.application_id,
            borrower_id: facilityFields.borrower_id,
            cif_number: borrowerDetails.cif_number,
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
        
        
        // Create the NLS Loan based on credit type
        switch (facilityFields.credit_type) {
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
        const syncJob = await syncNLSWithFacility(facility);
        if(syncJob !== 'SUCCESS') {
            console.log('error syncing facility with nls');
            throw new Error("NLS Sync Error");
        }

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
    }
    
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

    const {repayment_bank_details} = req.body

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


        facility.repayment_bank_details = repayment_bank_details;
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


// @route     GET facility by id
// @desc      Retrieve an facility's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
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

        // Response
        let facilityResponse = await Facility.findOne({ id: facility.id, client_id: req.client_id })
            .select(responseFilters['facility'] + ' -client_id');
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

    const syncJob = await syncNLSWithFacility(facility);

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

const syncNLSWithFacility = async (facility) => {
    try {
        console.log('pre-synced facility')
        console.log(facility)

        // verify nls loan ref exists
        if(!facility.nls_account_ref) {
            return "ERROR: this facility does not have a nls_loan_ref"
        }

        // get nls loan details
        let nlsLoan = await retrieveNLSLoan(facility.nls_account_ref);

        // populate facility with updated info
        if(nlsLoan !== "nls_error") {
            // populate facility based on type
            switch (facility.credit_type) {
                case "consumer_revolving_line_of_credit":
                case "consumer_installment_loan":
                case "consumer_bnpl":
                    facility.balance = Math.floor(nlsLoan.loanDetails.Current_Principal_Balance * 100);
                    facility.monthly_payment = Math.floor(nlsLoan.paymentDetails.Next_Payment_Total_Amount * 100); // redundant: deprecate!
                    facility.next_payment_amount = Math.floor(nlsLoan.paymentDetails.Next_Payment_Total_Amount * 100);
                    facility.next_payment_due_date = moment(nlsLoan.paymentDetails.Next_Principal_Payment_Date).format("YYYY/MM/DD");
                    facility.current_payment_due_date = moment(nlsLoan.paymentDetails.Current_Principal_Payment_Date).format("YYYY/MM/DD");
                    const last_payment_date = nlsLoan.paymentDetails.Last_Payment_Date;
                    facility.last_payment_date = last_payment_date ? moment(last_payment_date).format("YYYY/MM/DD") : null;
                    facility.principal_paid_thru = moment(nlsLoan.loanDetails.Principal_Paid_Thru_Date).format("YYYY/MM/DD");
                    facility.next_billing_date = moment(nlsLoan.loanDetails.Next_Billing_Date).format("YYYY/MM/DD");
                    facility.interest_accrued_thru =  moment(nlsLoan.loanDetails.Interest_Accrued_Thru_Date).format("YYYY/MM/DD");
                    facility.next_accrual_cutoff_date = moment(nlsLoan.loanDetails.Next_Accrual_Cutoff).format("YYYY/MM/DD");
                    const maturity_date = nlsLoan.loanDetails.Curr_Maturity_Date;
                    facility.scheduled_payoff_date = maturity_date ? moment(maturity_date).format("YYYY/MM/DD") : null;

                    // add payments due
                    // first reset the array
                    facility.payments_due = [];
                    // for each object in nlsLoan.loanDetails.Payments_Due
                    var paymentsDueData = nlsLoan.paymentsDue;
                    Object.values(paymentsDueData).forEach(pmtDueData => {
                        if (pmtDueData.Payment_Description === 'TOT PAYMENT') {
                            facility.payments_due.push({
                                payment_amount: Math.floor(pmtDueData.Payment_Amount * 100),
                                payment_amount_remaining: Math.floor(pmtDueData.Payment_Remaining * 100),
                                payment_due_date: moment(pmtDueData.Date_Due).format("YYYY/MM/DD")
                            })
                        }
                    })

                    // calc remaining term for loans with a populated amort schedule
                    const amortSchedule = nlsLoan.amortizationSchedule;
                    if(Object.keys(amortSchedule).length !== 0) {
                        var termCount = 0;
                        Object.values(amortSchedule).forEach(remainingPayment => {
                            if(!remainingPayment.IsHistory) {
                                termCount++;
                            }
                        })
                        facility.remaining_term = termCount;
                    }

                    break;
                default: console.log('cannot sync this type of credit product')
                    break;
            }
            
        } else {
            console.log('nls error. Unable to synchronize');
            return 'ERROR: Unable to synchronize'
        }

        // save facility
        await facility.save();

        console.log('Synced facility')
        console.log(facility)

        // Done
        return "SUCCESS"

    } catch (err) {
        console.error(err.message);
        return "ERROR: unexpected error"
    }
}

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
    try {

        // grab all facilities
        const facilities = await Facility.find();
        const errors = [];
        const skipped = [];
        var sync_count = 0;
        
        // loop thru each facility
        for (let i = 0; i < facilities.length; i++) {

            var facility = facilities[i]
            console.log(facility);
            if(!facility.nls_account_ref) {
                console.log('facility not setup in NLS. Skipping it')
                skipped.push(facility.facility_id);
                continue;
            }

            const syncJob = await syncNLSWithFacility(facility)

            if(syncJob !== "SUCCESS") {
                errors.push(facility.facility_id)
            } else {
                sync_count++;
            }

            // latency to avoid nls rate limit
            var waitTill = new Date(new Date().getTime() + 1 * 250);
            while(waitTill > new Date()){}
            
        }

        console.log('loop job complete')
        
        const jobReport = {
            msg: 'Facility Job complete',
            facility_count: facilities.length,
            sync_count: sync_count,
            skipped: skipped,
            errors: errors
        }

        console.log(jobReport)

    } catch (err) {
        console.log({error: 'critical error syncing facilities with NLS'})
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