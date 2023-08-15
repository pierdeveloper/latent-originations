const axios = require('axios').default;
const config = require('config');

// NLS auth token
var nlsToken = null;

// get auth token
const generateNLSAuthToken = async () => {
    
    // Return token if already generated
    if(nlsToken) {
        return nlsToken;
    }
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
        
        // set the nls token and return it
        nlsToken = bearerToken;
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
    console.log("Token revoked")
    nlsToken = null;

}

// calculate aprs for a list of offers
const calculateAPRs = async (offers) => {
    // Generate Auth token
    const nls_token = await generateNLSAuthToken();

    // create response object
    const offers_data = [...offers]

    // for each offer, calculate apr
    for (let index = 0; index < offers_data.length; index++) {
        const offer = offers_data[index];

        try {
            // NLS config
            const url = `https://api.nortridgehosting.com/25.0/nls/apr`;
            const auth = 'Bearer ' + nls_token;
            const header = {'Authorization': auth, 'content-type': 'application/x-www-form-urlencoded'}
    
            // default values for first payment period
            const oddDaysInFirstPeriod = 0;
            const periodsInFirstPeriod = 1;
            const paymentPeriod = 'MO'

            // set body payload for request                    
            let payload = {
                LoanAmount: offer.amount / 100,
                FirstPaymentAmount: offer.periodic_payment / 100,
                RegularPaymentAmount: offer.periodic_payment / 100,
                NumberOfPayments: offer.term,
                PaymentPeriod: paymentPeriod,
                OddDaysInFirstPeriod: oddDaysInFirstPeriod,
                PeriodsInFirstPeriod: periodsInFirstPeriod,
                LastPaymentAmount: offer.periodic_payment / 100
            }
            console.log('payload', payload)
    
            // axios call
            let response = await axios.post(url, payload, {headers: header})
            console.log(response.data);
    
            const apr_raw = response.data.payload.data
    
            if(!apr_raw) {
                throw new Error('nls error')
            }

            // convert raw apr to bps integer
            const apr = parseInt((apr_raw.toFixed(2) * 100).toFixed(0))
    
            console.log(`apr: ${apr}`)
            offers_data[index].apr = apr;

        } catch (error) {
            console.log('error trying to accrue nls loan')
            console.log(error.response.data);
    
            // Revoke token
            await revokeNLSAuthToken(nls_token)
            return "nls_error"
        }
        
        // add some artifical latency to avoid triggering rate limits
        var waitTill = new Date(new Date().getTime() + 250);
        while(waitTill > new Date()){}
    }
        
    // Revoke token
    await revokeNLSAuthToken(nls_token);

    return offers_data;
              
}

module.exports = {
    calculateAPRs
}