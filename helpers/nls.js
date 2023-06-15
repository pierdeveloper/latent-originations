const axios = require('axios').default;
const moment = require('moment');
const config = require('config');
const pierFormats = require('../helpers/formats');

// get auth token
const generateNLSAuthToken = async () => {
    const CLIENT_ID = config.get('nls_client_id');
    const CLIENT_SECRET = config.get('nls_secret');
    const USERNAME = config.get('nls_username');
    const PASSWORD = config.get('nls_password');
    const SCOPE = config.get('nls_scope');
    
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

    
        let response = await axios.post(url, payload, {headers: header})
        const accessToken = response.data.access_token;
        const bearerToken = 'Bearer ' + accessToken;
        console.log('Bearer token:', bearerToken);
        return accessToken;
    
}

// Revoke token
const revokeNLSAuthToken = async (token) => {

    /////
    const CLIENT_ID = config.get('nls_client_id');
    const CLIENT_SECRET = config.get('nls_secret');
    
    const url = 'https://auth.nortridgehosting.com/25.0/core/connect/revocation';

    const auth = 'Basic ' + Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString('base64');
    const header = {'content-type': 'application/x-www-form-urlencoded', 'Authorization': auth}

    let payload = {
        token: token.toString(),
        token_type_hint: 'access_token'
    }

    console.log("Revoking token..")
    let response = await axios.post(url, payload, {headers: header})

}



// create a contact
const createNLSConsumer = async (borrowerDetails) => {
    // Generate Auth token
    const nls_token = await generateNLSAuthToken();
    
    try {     
        // NLS config
        const url = `https://api.nortridgehosting.com/25.0/nls/xml-import?test=false`;
        const auth = 'Bearer ' + nls_token;
        const header = {'Content-Type': 'application/xml', 'Accept': 'application/json',
        'Authorization': auth}
        
        // Create NLS user data fields
        const first_name = borrowerDetails.first_name;
        const last_name = borrowerDetails.last_name;
        const cif_number = borrowerDetails.cif_number;

        const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
            <NLS CommitBlock="1" EnforceTagExistence="1">
            <CIF 
                UpdateFlag="0"
                CIFNumber="${cif_number}"
                Entity="Individual"
                CIFPortfolioName="CONSUMER" 
                ShortName="${first_name} ${last_name}"
                FirstName1="${first_name}"
                LastName1="${last_name}"
            >
            </CIF>
            </NLS>`

        // Request
        await axios.post(url, xmlData, {headers: header})
        
        // Revoke token
        await revokeNLSAuthToken(nls_token);
        return "nls_success"
    } catch (error) {
        console.log('error trying to create nls consumer')
        console.log(error.response.data);

        // Revoke token
        await revokeNLSAuthToken(nls_token)
        return "nls_error"
    }
   
}
// create bnpl loan
const createNLSLoan = async (facility) => {
    // Generate Auth token
    const nls_token = await generateNLSAuthToken();

    console.log(`attempting to create nls loan for facility`)
    console.log(facility)

    try {
        // NLS config
        const url = `https://api.nortridgehosting.com/25.0/nls/xml-import?test=false`;
        const auth = 'Bearer ' + nls_token;
        const header = {'Content-Type': 'application/xml', 'Accept': 'application/json',
        'Authorization': auth}
        
        // Create NLS loan data fields
        const cif_number = facility.cif_number;
        const nls_group_name = facility.nls_group_name;
        const account_number = facility.account_number;
        const origination_date = moment(facility.origination_date).format(pierFormats.shortDate); // set facility og date based on our format
        const nls_origination_date = moment(origination_date).format("MM/DD/YYYY") // convert to nls format
        const amount = facility.terms.amount / 100;
        const term = facility.terms.term;
        const interest_rate = facility.terms.interest_rate / 100;
        const repayment_frequency = facility.terms.repayment_frequency;
        const term_type = facility.terms.repayment_frequency === 'monthly' ? 'Months' : 'Payments'
        const billing_cutoff = facility.terms.repayment_frequency === 'monthly' ? -15 : -10
        var payment_period = '';
        switch (repayment_frequency) {
            case 'monthly': payment_period = 'MO'; break;
            case 'biweekly': payment_period = 'BW'; break;
            case 'weekly': payment_period = 'WE'; break;
            case 'semi_monthly': payment_period = 'SM'; break;
            default: 
                // throw error
                console.log('error: invalid repayment frequency')
                await revokeNLSAuthToken(nls_token)
                return 'nls_error'

        }

        console.log(`payment period: ${payment_period}`)
        const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
            <NLS CommitBlock="1" EnforceTagExistence="1">
            <LOAN 
                UpdateFlag="0"
                CIFNumber="${cif_number}"
                LoanTemplateName="CONSUMER_BNPL"
                LoanNumber="${account_number}"
                LoanGroupName="${nls_group_name}"
                OriginationDate="${nls_origination_date}" 
                LoanAmount="${amount}"
                InterestMethod="FA"
                PrincipalPaymentPeriod="${payment_period}"
                InterestPaymentPeriod="${payment_period}"
                Term="${term}"
                TermDue="${term}"
                TermType="${term_type}"
                BillingCutoff="${billing_cutoff}"
                >
                <LOANINTERESTRATERECORD
                InterestType="0"    
                DefaultInterestPeriod="MO"
                InterestRate="${interest_rate}"
                >
                </LOANINTERESTRATERECORD>
            </LOAN>
            </NLS>`

        console.log(`xml data: ${xmlData}`)
        // Request
        const response = await axios.post(url, xmlData, {headers: header})
        console.log(response.data);

        // find accountrefno via NLS search
        const url2 = `https://api.nortridgehosting.com/25.0/loans/search`
        const header2 = {'content-type': 'application/x-www-form-urlencoded', 'Authorization': auth}

        let payload = {
            Loan_Number: facility.account_number
        }

        let response2 = await axios.post(url2, payload, {headers: header2})

        let response_data = response2.data.payload.data
        
        if(response_data.length !== 1) {
            throw new Error('nls error')
        }

        const nls_loan = response_data[0]
        let nls_account_ref = nls_loan['Acctrefno'];
        console.log('details of created nls loan:')
        console.log(nls_loan)
        
        // Revoke token
        await revokeNLSAuthToken(nls_token);
        return { nls_account_ref: nls_account_ref}
        
    } catch (error) {
        console.log('error trying to create nls loan')
        console.log(error.response);

        // Revoke token
        await revokeNLSAuthToken(nls_token)
        return "nls_error"
    }
}

// create line of credit
const createNLSLineOfCredit = async (facility) => {
    // Generate Auth token
    const nls_token = await generateNLSAuthToken();

    try {
        // NLS config
        const url = `https://api.nortridgehosting.com/25.0/nls/xml-import?test=false`;
        const auth = 'Bearer ' + nls_token;
        const header = {'Content-Type': 'application/xml', 'Accept': 'application/json',
        'Authorization': auth}
        
        // Create NLS loan data fields
        const cif_number = facility.cif_number;
        const nls_group_name = facility.nls_group_name;
        const account_number = facility.account_number;
        const origination_date = moment(facility.origination_date).format(pierFormats.shortDate);
        const nls_origination_date = moment(origination_date).format("MM/DD/YYYY");
        const amount = facility.terms.amount / 100;
        //const term = facility.terms.term;
        const interest_rate = facility.terms.interest_rate / 100;

        const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
            <NLS CommitBlock="1" EnforceTagExistence="1">
            <LOAN 
                UpdateFlag="0"
                CIFNumber="${cif_number}"
                LoanTemplateName="LINE_OF_CREDIT"
                LoanNumber="${account_number}"
                LoanGroupName="${nls_group_name}"
                OriginationDate="${nls_origination_date}" 
                InterestMethod="AD"
                >

                <LOANCREDITLINE
                  CreditLineLimit="${amount}"
                > 
                </LOANCREDITLINE>

                <LOANINTERESTRATERECORD
                InterestType="0"    
                InterestRate="${interest_rate}"
                >
                </LOANINTERESTRATERECORD>
            </LOAN>
            </NLS>`

        console.log(`xml data: ${xmlData}`)
        // Request
        const response = await axios.post(url, xmlData, {headers: header})
        console.log(response.data);

        // find accountrefno via NLS search
        const url2 = `https://api.nortridgehosting.com/25.0/loans/search`
        const header2 = {'content-type': 'application/x-www-form-urlencoded', 'Authorization': auth}

        let payload = {
            Loan_Number: facility.account_number
        }

        let response2 = await axios.post(url2, payload, {headers: header2})

        let response_data = response2.data.payload.data
        
        if(response_data.length !== 1) {
            throw new Error('nls error')
        }

        const nls_loan = response_data[0]
        let nls_account_ref = nls_loan['Acctrefno'];
        
        // Revoke token
        await revokeNLSAuthToken(nls_token);
        return { nls_account_ref: nls_account_ref}
        
    } catch (error) {
        console.log('error trying to create nls loan')
        console.log(error.response.data);

        // Revoke token
        await revokeNLSAuthToken(nls_token)
        return "nls_error"
    }
}

// retrieve loan with id
const retrieveNLSLoan = async (loanRef) => {
    // Generate Auth token
    const nls_token = await generateNLSAuthToken();
    var fullLoanDetails = { loanDetails: {}, paymentDetails: {},
        paymentsDue: {}, statistics: {}, paymentHistory: {}, amortizationSchedule: {}, };

    try {
        // NLS config
        const url = `https://api.nortridgehosting.com/25.0/loans/${loanRef}?test=false`;
        const auth = 'Bearer ' + nls_token;
        const header = {'Accept': 'application/json','Authorization': auth}
        
        // Request loan details and append to data object
        const response = await axios.get(url, {headers: header});
        const loanData = response.data.payload.data;
        Object.assign(fullLoanDetails.loanDetails, loanData);

        // Request payment details and append to data obje
        const url2 = `https://api.nortridgehosting.com/25.0/loans/${loanRef}/payment-info`
        const response2 = await axios.get(url2, {headers: header});
        const paymentData = response2.data.payload.data;
        Object.assign(fullLoanDetails.paymentDetails, paymentData);
        
        // Request amort table and append to data object
        const url3 = `https://api.nortridgehosting.com/25.0/loans/${loanRef}/amortization-schedule`
        const response3 = await axios.get(url3, {headers: header});
        const amortSchedData = response3.data.payload.data;
        Object.assign(fullLoanDetails.amortizationSchedule, amortSchedData);

        // Request payment schedule and append to data object
        const url4 = `https://api.nortridgehosting.com/25.0/loans/${loanRef}/payment-history`
        const response4 = await axios.get(url4, {headers: header});
        const paymentHistoryData = response4.data.payload.data;
        Object.assign(fullLoanDetails.paymentHistory, paymentHistoryData);

        // Request payments due and append to data object
        const url5 = `https://api.nortridgehosting.com/25.0/loans/${loanRef}/payments-due`
        const response5 = await axios.get(url5, {headers: header});
        const paymentsDueData = response5.data.payload.data;
        Object.assign(fullLoanDetails.paymentsDue, paymentsDueData);


        // Request statistics and append to data object
        const url6 = `https://api.nortridgehosting.com/25.0/loans/${loanRef}/statistics`
        const response6 = await axios.get(url6, {headers: header});
        const statisticsData = response6.data.payload.data;
        Object.assign(fullLoanDetails.statistics, statisticsData);
        
        console.log(fullLoanDetails)
        
        // Revoke token
        await revokeNLSAuthToken(nls_token);
        return fullLoanDetails
        
    } catch (err) {
        // Revoke token
        await revokeNLSAuthToken(nls_token)

        console.log('error trying to get nls loan')
        console.log(err);        
        return "nls_error"
    }
}

// Synchronize a facility with NLS
const syncFacilityWithNLS = async (facility) => {
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
                    facility.next_payment_due_date = moment(nlsLoan.paymentDetails.Next_Principal_Payment_Date).format(pierFormats.shortDate);
                    facility.current_payment_due_date = moment(nlsLoan.paymentDetails.Current_Principal_Payment_Date).format(pierFormats.shortDate);
                    const last_payment_date = nlsLoan.paymentDetails.Last_Payment_Date;
                    facility.last_payment_date = last_payment_date ? moment(last_payment_date).format(pierFormats.shortDate) : null;
                    facility.principal_paid_thru = moment(nlsLoan.loanDetails.Principal_Paid_Thru_Date).format(pierFormats.shortDate);
                    facility.next_billing_date = moment(nlsLoan.loanDetails.Next_Billing_Date).format(pierFormats.shortDate);
                    facility.interest_accrued_thru =  moment(nlsLoan.loanDetails.Interest_Accrued_Thru_Date).format(pierFormats.shortDate);
                    facility.next_accrual_cutoff_date = moment(nlsLoan.loanDetails.Next_Accrual_Cutoff).format(pierFormats.shortDate);
                    const maturity_date = nlsLoan.loanDetails.Curr_Maturity_Date;
                    facility.scheduled_payoff_date = maturity_date ? moment(maturity_date).format(pierFormats.shortDate) : null;

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
                                payment_due_date: moment(pmtDueData.Date_Due).format(pierFormats.shortDate)
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

// Post loan payment to NLS
const postPaymentToNLS = async (facility, payment) => {
    // Generate Auth token
    const token = await generateNLSAuthToken();
    const paymentDate = moment(payment.created_on).format("MM/DD/YYYY");
    if(process.env === 'development') {paymentDate = moment(config.get('today')).format("MM/DD/YYYY")}

    console.log('received NLS payment post request')
    console.log(facility)
    console.log(payment)
    try {
        // NLS config
        const url = `https://api.nortridgehosting.com/25.0/nls/xml-import?test=false`;
        const auth = 'Bearer ' + token;
        const header = {'Content-Type': 'application/xml', 'Accept': 'application/json',
        'Authorization': auth}

        // xml data
        const xmlData = 
            `<?xml version="1.0" encoding="UTF-8"?>
            <NLS CommitBlock="1" EnforceTagExistence="1">
                <TRANSACTIONS>
                    <PAYMENT 
                        LoanNumber="${facility.account_number}" 
                        Amount="${payment.amount / 100}" 
                        EffectiveDate="${paymentDate}"
                    />
                </TRANSACTIONS>
            </NLS>`

        console.log(`xml data: ${xmlData}`)
        // Request
        const response = await axios.post(url, xmlData, {headers: header})
        console.log('finished axios post request')
        console.log(response.data);
        
        // Revoke token
        await revokeNLSAuthToken(token);
        return "payment_posted"
        
    } catch (error) {
        // Revoke token
        await revokeNLSAuthToken(token)

        console.log('error trying to post nls loan payment')
        console.log(error.response.data);

        
        return "nls_error"
    }
}

// accrue a loan to a specific date (sandbox tool only)
const accrueNLSLoan = async (accountNumber, date) => {
    // Generate Auth token
    const nls_token = await generateNLSAuthToken();

    try {
        // NLS config
        const url = `https://api.nortridgehosting.com/25.0/nls/xml-import?test=false`;
        const auth = 'Bearer ' + nls_token;
        const header = {'Content-Type': 'application/xml', 'Accept': 'application/json',
        'Authorization': auth}
        
        // Create NLS data fields
        const advance_date = moment(date, "YYYY-MM-DD").format("MM/DD/YYYY");
    
        // xml data
        const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
            <NLS CommitBlock="1" EnforceTagExistence="1">
                <TRANSACTIONS UpdateAccrualThru="${advance_date}">
                    <PAYMENT LoanNumber="${accountNumber}" Amount="0.00" /> 
                </TRANSACTIONS>
            </NLS>`

        console.log(`xml data: ${xmlData}`)
        // Request
        const response = await axios.post(url, xmlData, {headers: header})
        console.log(response.data);
        
        // Revoke token
        await revokeNLSAuthToken(nls_token);
        return "accrual_complete"
        
    } catch (error) {
        console.log('error trying to accrue nls loan')
        console.log(error.response.data);

        // Revoke token
        await revokeNLSAuthToken(nls_token)
        return "nls_error"
    }
}

// calculate apr for loan terms
const calculateAPR = async (offerTerms, monthlyPayment) => {
    // Generate Auth token
    const nls_token = await generateNLSAuthToken();

    try {
        // NLS config
        const url = `https://api.nortridgehosting.com/25.0/nls/apr`;
        const auth = 'Bearer ' + nls_token;
        
        const header = {'Authorization': auth, 'content-type': 'application/x-www-form-urlencoded'}

        console.log('calculating apr')
        console.log(offerTerms)
        console.log(monthlyPayment)

        const origination_fee_amount = (offerTerms.origination_fee / 10000) * (offerTerms.amount / 100);
        const loanAmount = offerTerms.amount / 100 - origination_fee_amount;
        const paymentPeriod = offerTerms.repayment_frequency === 'monthly' 
            ? 'MO' : offerTerms.repayment_frequency === 'biweekly' 
            ? "BW" : offerTerms.repayment_frequency === 'semi_monthly' 
            ? "SM" : offerTerms.repayment_frequency === 'weekly'
            ? "WE" : "MO" // temporary default to monthly


        let payload = {
            LoanAmount: loanAmount,
            FirstPaymentAmount: monthlyPayment,
            RegularPaymentAmount: monthlyPayment,
            NumberOfPayments: offerTerms.term,
            PaymentPeriod: paymentPeriod,
            OddDaysInFirstPeriod: 0,
            PeriodsInFirstPeriod: 1,
            LastPaymentAmount: monthlyPayment
        }
        console.log(payload)

        // axios call
        let response = await axios.post(url, payload, {headers: header})
        console.log(response.data);

        const apr_raw = response.data.payload.data

        if(!apr_raw) {
            throw new Error('nls error')
        }
        // convert to bps integer
        const apr = parseInt((apr_raw.toFixed(2) * 100).toFixed(0))

        console.log(`apr: ${apr}`)
        
        // Revoke token
        await revokeNLSAuthToken(nls_token);
        
        // Return rounded apr
        return apr
        
    } catch (error) {
        console.log('error trying to accrue nls loan')
        console.log(error.response.data);

        // Revoke token
        await revokeNLSAuthToken(nls_token)
        return "nls_error"
    }

}

module.exports = {
    accrueNLSLoan,
    calculateAPR,
    createNLSConsumer,
    createNLSLoan,
    createNLSLineOfCredit,
    retrieveNLSLoan,
    syncFacilityWithNLS,
    postPaymentToNLS
}