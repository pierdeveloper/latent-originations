const axios = require('axios').default;
const moment = require('moment');
const config = require('config');


/*
    DOC SPRING HELPERS
*/

// POST
// Create a Docspring submission with template and data fields

const createDocSpringSubmission = async (template_id, doc_data_fields) => {
    // create docspring submission with applicant data

    const username = config.get('docspringId');
    const pw = config.get('docspringSecret');
    const auth = 'Basic ' + Buffer.from(username + ':' + pw).toString('base64');
    
    const header = {'user-agent': 'node.js', 'Authorization': auth}

    const body_params = {
        data: doc_data_fields,
        test: config.get('docspringTest'),
        editable: false
    }

    const response = await axios.post(
        `https://api.docspring.com/api/v1/templates/${template_id}/submissions`,
        JSON.stringify(body_params), 
        { headers: header }
    );
    console.log(`ds submission: `)
    console.log(response.data)
    return response.data;
  }

  const getDocSpringSubmission = async (submission_id) => {
    const username = config.get('docspringId');
    const pw = config.get('docspringSecret');
    const auth = 'Basic ' + Buffer.from(username + ':' + pw).toString('base64');
    const header = {'user-agent': 'node.js', 'Authorization': auth}
    const url = `https://api.docspring.com/api/v1/submissions/${submission_id}`;
    
    const response = await axios.get(
        url,
        { headers: header }
    );

    return response.data;

  }

// Helper function - generate data fields for docspring submission
const generateDocspringDataFields = (borrower_type, borrower, application, isSigned) => {
    
    const offer = application.offer;
    const doc_data_fields = {}

    if(borrower_type === 'consumer') {

        // standard fields   
        const consumer = borrower;
        const address_line_2 = consumer.address.line_2 ?? ""
        const today = new Date();
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' } 
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        });
        doc_data_fields.date = today.toLocaleDateString('en-us', dateOptions);
        doc_data_fields.amount = `${formatter.format(offer.amount / 100)}`;
        doc_data_fields.apr = `${offer.interest_rate / 100}%`;
        doc_data_fields.name = `${consumer.first_name} ${consumer.last_name}`;

        doc_data_fields.name_2 = isSigned ? `${consumer.first_name} ${consumer.last_name}` : " ";
        doc_data_fields.date_2 = isSigned ? today.toLocaleDateString('en-us', dateOptions) : " ";
        doc_data_fields.signature = isSigned ? `${consumer.first_name} ${consumer.last_name}` : " ";

        // basic credit product-specific fields
        switch (application.credit_type) {
            case "consumer_bnpl": // bnpl-specific fields populated after switch  
            case "consumer_installment_loan":
                doc_data_fields.address = `${consumer.address.line_1} ${address_line_2}`;
                doc_data_fields.city_state_zip = `${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
                // payment amount
                const periodic_payment_amount = calculate_periodic_payment(
                    offer.amount / 100,
                    offer.term,
                    12,
                    offer.interest_rate / 10000
                );
                doc_data_fields.payment_amount = `${formatter.format(periodic_payment_amount)}`
                doc_data_fields.payment_amount_2 = `${formatter.format(periodic_payment_amount)}`
                doc_data_fields.n_payments = (offer.term - 1);
                const finance_charge = (offer.term * periodic_payment_amount) - (offer.amount / 100);
                doc_data_fields.finance_charge = `${formatter.format(finance_charge)}`; 
                const total_of_payments = (offer.term * periodic_payment_amount);
                doc_data_fields.total_of_payments = `${formatter.format(total_of_payments)}`

                const first_payment_date = moment().add(1,'months').format("MM/DD/YYYY");
                const payments_due = `Monthly beginning ${first_payment_date}`;
                doc_data_fields.payments_due = payments_due;
                const final_due_date = moment().add(offer.term,'months').format("MM/DD/YYYY");
                doc_data_fields.final_payment_due = final_due_date;


                doc_data_fields.amount_to_you = `${formatter.format(offer.amount / 100)}`;
                doc_data_fields.total_financed = `${formatter.format(offer.amount / 100)}`;
                doc_data_fields.origination_fee = "$0.00";
                doc_data_fields.total_loan_amount = `${formatter.format(offer.amount / 100)}`;
                doc_data_fields.borrower_name = `${consumer.first_name} ${consumer.last_name}`;
                console.log('logging doc data fields')
                console.log(doc_data_fields);
                break;
            case "consumer_revolving_line_of_credit":
                doc_data_fields.email = `${consumer.email}`;
                doc_data_fields.address = `${consumer.address.line_1} ${address_line_2} ${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
                doc_data_fields.account_number = `${application.id}`;
                doc_data_fields.late_payment_fee = `${formatter.format(offer.late_payment_fee / 100)}`;
                doc_data_fields.annual_fee = `${formatter.format(offer.annual_fee / 100)}`
                doc_data_fields.origination_fee = `${formatter.format(offer.origination_fee / 100)}`
                doc_data_fields.whitespace = true;
                break;
            case "consumer_closed_line_of_credit":
                doc_data_fields.email = `${consumer.email}`;
                doc_data_fields.address = `${consumer.address.line_1} ${address_line_2} ${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
                doc_data_fields.account_number = `${application.application_id}`;
                doc_data_fields.late_payment_fee = `${formatter.format(offer.late_payment_fee / 100)}`;
                doc_data_fields.annual_fee = `${formatter.format(offer.annual_fee / 100)}`
                doc_data_fields.origination_fee = `${formatter.format(offer.origination_fee / 100)}`
                doc_data_fields.whitespace = true;
                break;
        
            default: break;
        }
        console.log(`3rd party: ${offer.third_party_disbursement_destination}`)
        // bnpl type-specific fields
        if(application.credit_type === "consumer_bnpl") {
            doc_data_fields.merchant_name = `${offer.third_party_disbursement_destination}.`
            doc_data_fields.amount_to_others = `${formatter.format(offer.amount / 100)}`
            doc_data_fields.amount_to_you = `${formatter.format(0)}`
        }
    } else { // business borrower
        // standard fields
        const business = borrower;
        const address_line_2 = business.address.line_2 ?? ""
        const today = new Date();
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' } 
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            });
        doc_data_fields.officer_name_2 = isSigned ? `${business.business_contact.first_name} ${business.business_contact.last_name}` : " ";
        doc_data_fields.officer_title_2 = isSigned ? `${business.business_contact.title}` : " ";
        doc_data_fields.entity_name_2 = isSigned ? `${business.business_name}` : " ";
        doc_data_fields.signature_date = isSigned ? today.toLocaleDateString('en-us', dateOptions) : " ";
        doc_data_fields.signature = isSigned ? `${business.business_contact.first_name} ${business.business_contact.last_name}` : " ";

        // credit product-specific fields
        switch (application.credit_type) {
            case "commercial_installment_loan": 
                break;
            case "commercial_bnpl": 
                break;
            case "commercial_revolving_line_of_credit":
                doc_data_fields.date = today.toLocaleDateString('en-us', dateOptions);
                doc_data_fields.account_number = `${application.id}`;
                doc_data_fields.annual_fee = `${formatter.format(offer.annual_fee / 100)}`
                doc_data_fields.origination_fee = `${formatter.format(offer.origination_fee / 100)}`
                doc_data_fields.credit_limit = `${formatter.format(offer.amount / 100)}`;
                doc_data_fields.apr = `${offer.interest_rate / 100}%`;
                doc_data_fields.late_payment_fee = `${formatter.format(offer.late_payment_fee / 100)}`;
                doc_data_fields.entity_name = `${business.business_name}`;
                doc_data_fields.entity_type = `${business.business_type}`;
                doc_data_fields.ein = `${business.ein}`;
                doc_data_fields.address = `${business.address.line_1} ${address_line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;
                doc_data_fields.phone = `${business.phone}`;
                doc_data_fields.officer_name = `${business.business_contact.first_name} ${business.business_contact.last_name}`;
                doc_data_fields.officer_title = `${business.business_contact.title}`;
                doc_data_fields.officer_address = `${business.address.line_1} ${business.address_line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;
                doc_data_fields.whitespace = true;
                break;
            case "commercial_closed_line_of_credit":
                break;
        
            default: break;
        }
    }
    return doc_data_fields;
}

const docspringTemplates = {
    consumer_installment_loan: "tpl_CxaCsG7LtLH9Jksez2",
    consumer_bnpl: "tpl_eyyPPRERjTyn2Z4QJy",
    consumer_revolving_line_of_credit: "tpl_m5cpPsgcqxk2RzM2cN",
    consumer_closed_line_of_credit: "",
    commercial_installment_loan: "",
    commercial_bnpl: "",
    commercial_revolving_line_of_credit: "tpl_CbSMf49ckCdT6fLNYh",
    commercial_closed_line_of_credit: ""
}


// HELPER FUNCTION - CALCULATE PERIODIC PAYMENTS

const calculate_periodic_payment = (amount, n_payments, payments_per_year, apr) => {
    const i = apr/payments_per_year;
    const a = amount;
    const n = n_payments;
    
    if (apr === 0) {
        const periodic_payment = a / n_payments;
        console.log(i);
        console.log(a);
        console.log(n);
        console.log(`per pay formula yielding: ${periodic_payment}`)
        return periodic_payment.toFixed(2);
    } else {
        const periodic_payment = a / (((1+i)**n)-1) * (i*(1+i)**n);
        console.log(i);
        console.log(a);
        console.log(n);
        console.log(`per pay formula yielding: ${periodic_payment}`)
        return periodic_payment.toFixed(2);
    }
    
}

module.exports = {
    calculate_periodic_payment,
    docspringTemplates,
    generateDocspringDataFields,
    createDocSpringSubmission,
    getDocSpringSubmission
}