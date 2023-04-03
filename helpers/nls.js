const axios = require('axios').default;
const moment = require('moment');
const config = require('config');

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
        const origination_date = moment(facility.origination_date).format("YYYY/MM/DD"); // set facility og date based on our format
        const nls_origination_date = moment(origination_date).format("MM/DD/YYYY") // convert to nls format
        const amount = facility.terms.amount / 100;
        const term = facility.terms.term;
        const interest_rate = facility.terms.interest_rate / 100;

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
                Term="${term}"
                TermDue="${term}"
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
        const origination_date = moment(facility.origination_date).format("YYYY/MM/DD");
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
        paymentsDue: {}, statistics: {}, paymentSchedule: {}, amortizationSchedule: {}, };

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
        const url4 = `https://api.nortridgehosting.com/25.0/loans/${loanRef}/payment-schedule`
        const response4 = await axios.get(url4, {headers: header});
        const paymentSchedData = response4.data.payload.data;
        Object.assign(fullLoanDetails.paymentSchedule, paymentSchedData);

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
        
    } catch (error) {
        console.log('error trying to get nls loan')
        console.log(error.response.data);

        // Revoke token
        await revokeNLSAuthToken(nls_token)
        return "nls_error"
    }
}

module.exports = {
    createNLSConsumer,
    createNLSLoan,
    createNLSLineOfCredit,
    retrieveNLSLoan
}