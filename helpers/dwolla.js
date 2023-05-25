const axios = require('axios').default;
const moment = require('moment');
const config = require('config');
const { decrypt } = require('../helpers/crypto.js');


//const baseUrl = config.get('dwolla.environment') !== 'production' ? 'https://api-sandbox.dwolla.com' : 'https://api.dwolla.com';

const baseUrl = process.env.NODE_ENV !== 'production'
    ? 'https://api-sandbox.dwolla.com'
    : 'https://api.dwolla.com';

// GENERATE DWOLLA TOKEN
const generateDwollaToken = async () => {
    const client_id = config.get('dwolla.client_id');
    const secret = config.get('dwolla.client_secret');
    const auth = 'Basic ' + Buffer.from(client_id + ':' + secret).toString('base64');

    console.log(`client id: ${client_id}`)
    console.log(`secret: ${secret}`)

    const header = {
        'Authorization': auth,
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const { data } = await axios.post(`${baseUrl}/token`, {
        grant_type: 'client_credentials'
    }, {headers: header});
    console.log('dwolla token:')
    console.log(data.access_token)
    return data.access_token;
}

// CREATE DWOLLA CUSTOMER
const createDwollaCustomer = async (first_name, last_name, email) => {
    const token = await generateDwollaToken();
    const payload = {
        firstName: first_name,
        lastName: last_name,
        email: email,
    }
    console.log(`payload: ${JSON.stringify(payload)}`)
    const header = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.dwolla.v1.hal+json'
    }
    const response = await axios.post(`${baseUrl}/customers`, payload, {headers: header})
    console.log(`response status: ${response.status}`)
    console.log(response.data)
    console.log(response.headers)
    if(response.status === 201) {
        const customer_id = response.headers.location.split('/').pop();
        console.log(`customer id: ${customer_id}`)
        return customer_id
    } else {
        console.log('error creating dwollacustomer')
        console.log(response)
        return 'dwolla_error'
    }
}

// LIST ALL DWOLLA CUSTOMERS
const listDwollaCustomers = async () => {
    const token = await generateDwollaToken();
    const payload = {}
    const header = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.dwolla.v1.hal+json'
    }
    const { data } = await axios.get(`${baseUrl}/customers`, {
        headers: header
    });
    return data._embedded['customers'];
}

// ADD FUNDING SOURCE TO CUSTOMER
const addDwollaFundingSource = async (facility) => {
    const token = await generateDwollaToken();
    const bank_details = facility.repayment_bank_details;
    const routing_number = bank_details.bank_routing_number;
    const encrypted_account_number = bank_details.bank_account_number;
    const decrypted_account_number = decrypt(encrypted_account_number);
    const dwolla_customer_id = facility.dwolla_customer_id;

    const payload = {
        routingNumber: routing_number,
        accountNumber: decrypted_account_number,
        bankAccountType: bank_details.type,
        name: `Loan Repayment obo ${facility.nls_group_name}`
    }
    console.log(`funding source setup payload: ${JSON.stringify(payload)}`)
    const header = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.dwolla.v1.hal+json'
    }
    var funding_source_id = ""
    await axios.post(`${baseUrl}/customers/${dwolla_customer_id}/funding-sources`, payload, {headers: header})
        .then(response => {
            if(response.status === 201) {
                funding_source_id = response.headers.location.split('/').pop();
                console.log(`added new funding source id: ${funding_source_id}`)
            }
        })
        .catch(error => {
            // handle case where bank details have already been added
            if(error.response.data.code === 'DuplicateResource') {
                funding_source_id = error.response.data._links.about.href.split('/').pop();
                console.log(`funding source already exists with id: ${funding_source_id}`)
            } else {
                console.log('error creating dwollacustomer')
                console.log(error.response)
                funding_source_id = 'dwolla_error'
            }
            return funding_source_id
        })
    console.log('exited axios block with funding_source_id: ' + funding_source_id)

    // for non-prod envs, verify the funding source
    if(process.env.NODE_ENV !== 'production') {
        const funding_source = await axios.get(`${baseUrl}/funding-sources/${funding_source_id}`, {headers: header})
        console.log(`retrieve funding source`)
        console.log(funding_source.data)
        if(funding_source.data.status !== 'verified') {
            // post and verify micros
            await axios.post(`${baseUrl}/funding-sources/${funding_source_id}/micro-deposits`, {}, {headers: header})
            const micros = {
                amount1: {
                    value: '0.01',
                    currency: 'USD'
                },
                amount2: {
                    value: '0.02',
                    currency: 'USD'
                }
            }
            // verify micros
            await axios.post(`${baseUrl}/funding-sources/${funding_source_id}/micro-deposits`, micros, {headers: header})


        }
    }

    return funding_source_id
}


// SUBMIT PAYMENT TO DWOLLA
const submitDwollaPayment = async (payment) => {
    const token = await generateDwollaToken();

    const pier_funding_source_id = config.get('dwolla.pier_funding_source_id');

    const amount = JSON.stringify(payment.amount / 100)
    const payload = {
        _links: {
            source: {
                href: `${baseUrl}/funding-sources/${payment.dwolla_funding_source_id}`
            },
            destination: {
                href: `${baseUrl}/funding-sources/${pier_funding_source_id}`
            }
        },
        amount: {
            currency: 'USD',
            value: amount
        },
        metadata: {
            pier_payment_id: payment.id,
        }
    }

    console.log(`dwolla payment submission payload: ${JSON.stringify(payload)}`)
    const header = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.dwolla.v1.hal+json'
    }

    var dwolla_transaction_id = ""

    await axios.post(`${baseUrl}/transfers`, payload, {headers: header})
        .then(response => {
            if(response.status === 201) {
                dwolla_transaction_id = response.headers.location.split('/').pop();
                console.log(`submitted transfer with dwolla id: ${dwolla_transaction_id}`)
            }
        })
        .catch(error => {
            console.log('error creating dwolla transfer')
            console.log(error)
            dwolla_transaction_id = 'dwolla_error'

        })
    console.log('exited axios block with tranaction_id: ' + dwolla_transaction_id)
    return dwolla_transaction_id
}

module.exports = {
    addDwollaFundingSource,
    createDwollaCustomer,
    listDwollaCustomers,
    submitDwollaPayment
}