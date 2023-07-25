
const { getError } = require('../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const Borrower = require('../models/Borrower');
const { Application, LoanOffer, LineOfCreditOffer } = require('../models/Application');
const Facility = require('../models/Facility');
const moment = require('moment');
const { createNLSLoan, createNLSLineOfCredit, syncFacilityWithNLS } = require('../helpers/nls.js');
const config = require('config');
const responseFilters = require('../helpers/responseFilters.json');
const { WebClient } = require('@slack/web-api');
const pierFormats = require('../helpers/formats.js');

// function to creat facility
async function createFacility(loan_agreement_id, client_id, autocreate = false) {
    try {
        // pull up the loan agreement
        let loan_agreement = await Document.findOne({ id: loan_agreement_id });

        // verify it exists
        if(!loan_agreement || loan_agreement.client_id !== client_id) {
            const error = getError("document_not_found")
            return { error: {
                    error_status: error.error_status,
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                }
            }
        }

        // confirm loan_agreement status is SIGNED
        if(loan_agreement.status !== 'signed') {
            const error = getError("facility_cannot_be_created")
            return { error: {
                    error_status: error.error_status,    
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                }
            }
        }

        // Confirm a facility for this loan agreement does not already exist (ignore for dev)
        if(process.env.NODE_ENV !== 'development') {
            let existingFacility = await Facility
                .findOne({ loan_agreement_id: loan_agreement.id });
            if(existingFacility) {
                const error = getError("facility_already_exists")
                return { error: {
                        error_status: error.error_status,   
                        error_type: error.error_type,
                        error_code: error.error_code,
                        error_message: error.error_message
                    }
                }
            }
        }

        // Pull up relevant application
        let application = await Application.findOne({ id: loan_agreement.application_id })

        var accepted_offer = {}
        switch(application.credit_type) {
            case 'consumer_installment_loan':
            case 'consumer_bnpl':
                accepted_offer = await LoanOffer.findOne({ id: loan_agreement.accepted_offer_id })
                break;
            case 'consumer_revolving_line_of_credit':
                accepted_offer = await LineOfCreditOffer.findOne({ id: loan_agreement.accepted_offer_id })
                break;
            default: break;
        }

        // Only allow supported products
        if(!['consumer_bnpl', 'consumer_revolving_line_of_credit', 'consumer_installment_loan', 'commercial_net_terms', 'commercial_merchant_advance'].includes(application.credit_type)) {
            const error = getError("unsupported_product")
            return { error: {
                    error_status: error.error_status,
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                }
            }
        }

        // Get portfolio id from client resource
        const client = await Customer.findOne({client_id: client_id});
        
        // check if this is not auto create + client auto create set to true
        if(!autocreate && client.facility_autocreate) {
            const error = getError("unsupported_product")
            return { error: {
                    error_status: error.error_status,
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                }
            }
        }

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

        // Build facility object based on credit type
        switch (facilityFields.credit_type) {
            case "consumer_bnpl":
            case "consumer_installment_loan":              
                facilityFields.disbursement_date = facilityFields.origination_date;
                facilityFields.remaining_term = accepted_offer.loan_term.term;            
                break;

            case "consumer_revolving_line_of_credit":
                facilityFields.disbursement_date = null
                break
        
            default:
                break;
        }
        console.log(facilityFields)
        
        const cif_number = borrowerDetails.cif_number 
        ? borrowerDetails.cif_number 
        : application.credit_type = 'commercial_merchant_advance' 
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
            terms: accepted_offer,
            origination_date: facilityFields.origination_date,
            disbursement_date: facilityFields.disbursement_date,
            balance: facilityFields.balance,
            nls_group_name: facilityFields.nls_group_name,
            autopay_enabled: facilityFields.autopay_enabled,
            remaining_term: facilityFields.remaining_term,
        })
        console.log(facility)
        
        if(facilityFields.credit_type === 'commercial_merchant_advance') {
            facility.balance = application.offer.amount
        }
        
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
        if(facility.credit_type !== 'commercial_merchant_advance') {
            const syncJob = await syncFacilityWithNLS(facility);
            if(syncJob !== 'SUCCESS') {
                console.log('error syncing facility with nls');
                throw new Error("NLS Sync Error");
            }
        } else { 
            facility.terms.interest_type = 'other'
            facility.terms.finance_charge = application.offer.finance_charge
            facility.terms.late_payment_fee = 0
            await facility.save() 
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
        return facilityResponse;
        
    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return { error: {
                error_status: error.error_status,
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            }
        }
    }
}

module.exports = {
    createFacility
}