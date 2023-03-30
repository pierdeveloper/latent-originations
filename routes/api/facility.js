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

        // Confirm a facility for this loan agreement does not already exist
        

        // ******  OMITTING FOR TESTING ONLY. UNCOMMENT ONCE FINISHED TESTING!! *(*********)
/*
        let existingFacility = await Facility
            .findOne({ loan_agreement_id: loan_agreement.id });
        if(existingFacility) {
            const error = getError("facility_already_exists")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }*/

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
                facilityFields.balance = application.offer.amount;
                facilityFields.monthly_payment = calculate_periodic_payment(
                    application.offer.amount / 100,
                    application.offer.term,
                    12,
                    (application.offer.interest_rate / 10000)
                ) * 100
                
                facilityFields.disbursement_date = facilityFields.origination_date;
                facilityFields.next_payment_due_date = moment(facilityFields.origination_date).add(1, 'months').format("YYYY/MM/DD");
                
                facilityFields.remaining_term = application.offer.term;
                facilityFields.scheduled_payoff_date = moment(facilityFields.origination_date)
                    .add(facilityFields.remaining_term, 'months').format("YYYY/MM/DD");
                
                break;
            case "consumer_revolving_line_of_credit":
                facilityFields.balance = 0
                facilityFields.next_payment_due_date = moment(facilityFields.origination_date).add(1, 'months').format("YYYY/MM/DD");
                break

            case "consumer_revolving_line_of_credit":
                facilityFields.balance = 0
                facilityFields.next_payment_due_date = moment(facilityFields.origination_date).add(1, 'months').format("YYYY/MM/DD");
                break

            
        
            default:
                break;
        }
        
       
        
        // 3. create facility
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
            monthly_payment: facilityFields.monthly_payment,
            nls_group_name: facilityFields.nls_group_name,
            next_payment_due_date: facilityFields.next_payment_due_date,
            autopay_enabled: facilityFields.autopay_enabled,
            remaining_term: facilityFields.remaining_term,
            scheduled_payoff_date: facilityFields.scheduled_payoff_date
        })
        
        
        //4. Create the facility in NLS based on credit type
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
        
            default:
                break;
        }
        
        await facility.save();

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

        let nlsLoan = await retrieveNLSLoan(facility.nls_account_ref);
        if(nlsLoan !== "nls_error") {
            // populate facility
            facility.remaining_balance = Math.floor(nlsLoan.loanDetails.Current_Payoff_Balance * 100);
            facility.monthly_payment = Math.floor(nlsLoan.paymentDetails.Next_Payment_Total_Amount * 100);
            facility.next_payment_due_date = moment(nlsLoan.paymentDetails.Next_Principal_Payment_Date).format("YYYY/MM/DD");
            const maturity_date = nlsLoan.loanDetails.Curr_Maturity_Date;
            facility.scheduled_payoff_date = maturity_date ? moment(maturity_date).format("YYYY/MM/DD") : undefined;
        }

        // save facility
        await facility.save();

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

    try {

        // verify facility exists
        const facility = await Facility.findOne({ id: req.params.id });
        if(!facility) {
            const error = getError("facility_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        console.log(facility)

        // verify nls loan ref exists
        if(!facility.nls_account_ref) {
            return res.status(404).json({ error: 'this facility does not have a nls_loan_ref'})
        }

        // get nls loan details
        let nlsLoan = await retrieveNLSLoan(facility.nls_account_ref);

        // populate facility with updated info
        if(nlsLoan !== "nls_error") {
            // populate facility based on type
            switch (facility.credit_type) {
                case "consumer_installment_loan":
                case "consumer_bnpl":
                    facility.balance = Math.floor(nlsLoan.loanDetails.Current_Payoff_Balance * 100);
                    facility.monthly_payment = Math.floor(nlsLoan.paymentDetails.Next_Payment_Total_Amount * 100);
                    facility.next_payment_due_date = moment(nlsLoan.paymentDetails.Next_Principal_Payment_Date).format("YYYY/MM/DD");
                    const maturity_date = nlsLoan.loanDetails.Curr_Maturity_Date;
                    facility.scheduled_payoff_date = maturity_date ? moment(maturity_date).format("YYYY/MM/DD") : undefined;
                    break
                default: console.log('cannot sync this type of credit product')
                    break;
            }
            
        } else {
            console.log('nls error. Unable to synchronize');
        }

        // save facility
        await facility.save();

        // Response
        let facilityResponse = await Facility.findOne({ id: facility.id })
        res.json(facilityResponse);

    } catch (err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }

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
            // get nls loan details
            let nlsLoan = await retrieveNLSLoan(facility.nls_account_ref);
            console.log(Math.floor(nlsLoan.loanDetails.Current_Payoff_Balance * 100));
            console.log(Math.floor(nlsLoan.paymentDetails.Next_Payment_Total_Amount * 100));
            console.log(facility.next_payment_due_date = moment(nlsLoan.paymentDetails.Next_Principal_Payment_Date).format("YYYY/MM/DD"));
            const maturity_date = nlsLoan.loanDetails.Curr_Maturity_Date;
            console.log(maturity_date ? moment(maturity_date).format("YYYY/MM/DD") : undefined);

            
            // populate facility with updated info
            if(nlsLoan !== "nls_error") {
                console.log('no nls error found..')
                // populate facility based on type
                switch (facility.credit_type) {
                    case "consumer_installment_loan":
                    case "consumer_bnpl":
                        console.log('in the switch statement now..')
                        facility.balance = Math.floor(nlsLoan.loanDetails.Current_Payoff_Balance * 100);
                        facility.monthly_payment = Math.floor(nlsLoan.paymentDetails.Next_Payment_Total_Amount * 100);
                        facility.next_payment_due_date = moment(nlsLoan.paymentDetails.Next_Principal_Payment_Date).format("YYYY/MM/DD");
                        const maturity_date = nlsLoan.loanDetails.Curr_Maturity_Date;
                        facility.scheduled_payoff_date = maturity_date ? moment(maturity_date).format("YYYY/MM/DD") : undefined;
                        console.log('facility dets synced..')
                        sync_count++;
                        console.log(sync_count)
                        break
                    case "consumer_revolving_line_of_credit":
                        //todo
                        sync_count++;
                        break;
                    default: console.log('cannot sync this type of credit product')
                        break;
                }
                
            } else {
                console.log('nls error. Unable to synchronize faciilty ' + facility.id);
                errors.push(facility.id)
            }

            // save facility
            await facility.save();

            // latency to avoid nls rate limit
            var waitTill = new Date(new Date().getTime() + 2 * 1000);
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
        // Response
        res.json(jobReport);

    } catch (err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }

})




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