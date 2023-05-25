const axios = require('axios').default;
const moment = require('moment');
const config = require('config');
const {decrypt} = require('../helpers/crypto');

const baseUrl = (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging')
    ? 'https://api-sandbox.stitchcredit.com:443/api' : 'https://mware.crscreditapi.com/api';

// Generate a token for CRS API
const generateCRSToken = async () => {
    const url = `${baseUrl}/users/login`
    const clientId = config.get('crs.client_id')
    const secret = config.get('crs.secret')

    const header = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    
    const payload = {
        'username': clientId,
        'password': secret
    }

    const { data } = await axios.post(url, payload, {headers: header});
    
    const token = data.token
    
    console.log(`token: ${token}`)

    return token
}

// function to pull experian report
const pullSoftExperianReport = async (consumer) => {
    const token = await generateCRSToken();

    const url = `${baseUrl}/experian/credit-profile/credit-report/basic/exp-prequal-fico9`

    const header = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'user-agent': 'node.js'
    }

    let encrypted_ssn = consumer.ssn
    let decrypted_ssn = decrypt(encrypted_ssn)

    var payload = {}
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        payload = {
            "firstName": consumer.first_name,
            "lastName": consumer.last_name,
            "street1": consumer.address.line_1,
            "street2": consumer.address.line_2 || '',
            "city": consumer.address.city,
            "state": consumer.address.state,
            "zip": consumer.address.zip,
            "ssn": decrypted_ssn,
            "dob": consumer.date_of_birth,
            "phone": "0000000000"
        }
    } else {
        // 740 no bankrupcty
        
        payload = {
            "firstName": "JANET",
            "lastName": "HARRINGSHAW",
            "street1": "600 THOMAS NELSON DR",
            "street2": "",
            "city": "VIRGINIA BEACH",
            "state": "VA",
            "zip": "234521911",
            "ssn": "666252975"
        }
    
        //  640 w/ bankruptcy history
        /*
        payload = {
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
    */
        // no hit
        /*
        payload = {
            "firstName": "FindMeExp",
            "lastName": "CantEven",
            "street1": "9817 LOOP BLVD",
            "street2": "APT G",
            "city": "CALIFORNIA CITY",
            "state": "CA",
            "zip": "935051352",
            "ssn": "666455730"
        }
*/
    
        // frozen
        /*
        payload = {
            "firstName": "MARK",
            "lastName": "KINTEH",
            "street1": "4930 KNIGHTS WAY",
            "street2": "",
            "city": "ANCHORAGE",
            "state": "AK",
            "zip": "995084808",
            "ssn": "666533460"
        }
    */
    }
    


    console.log(`crs payload: ${JSON.stringify(payload)}`)
    const response = await axios.post(url, payload, {headers: header, responseType: 'json'});
    const data = response.data

    const report = data
    // override for testing high score report.riskModel[0].score = '0781'
    console.log(`crs response data: ${JSON.stringify(report)}`)

    return report;
    
}

const experianBankruptcyCodes = {
    publicRecord: ['13', '15', '16', '17', '22', '23', '24', '25', '26', '27', '28', '29'],
    tradeline: ['67', '69']
}

module.exports = {
    generateCRSToken,
    pullSoftExperianReport,
    experianBankruptcyCodes
}