const axios = require('axios').default;
const moment = require('moment');
const config = require('config');
const pierFormats = require('../helpers/formats');
const { calculateAPR } = require('../helpers/nls.js');


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

    try {
        const response = await axios.post(
            `https://api.docspring.com/api/v1/templates/${template_id}/submissions`,
            JSON.stringify(body_params), 
            { headers: header }
        );
        console.log(`ds submission: `)
        console.log(response.data)
        return response.data;
      }
    catch (error) {
        console.log('CAUGHT DOCSPRING ERROR')
        console.log(error)
    }
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

// Helper function - generate data fields for docspring loan doc submission
const generateDocspringDataFields = async (borrower_type, borrower, application, isSigned, templateId = null) => {
    console.log('running docspring doc fields populator')
    console.log(borrower_type, borrower, application, isSigned, templateId)
    
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
        const origination_fee_amount = (offer.origination_fee / 10000) * offer.amount
        console.log(`og fee amt ${origination_fee_amount}`)
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
                
                // set payments per year variable to 12, 24 or 26 depending on application.offer.repayment_frequency
                const payments_per_year = offer.repayment_frequency === 'monthly' 
                    ? 12 : offer.repayment_frequency === 'biweekly' 
                    ? 26 : 24;

                const amt = offer.amount / 100 + origination_fee_amount / 100;
                // payment amount
                const periodic_payment_amount = calculate_periodic_payment(
                    amt,
                    offer.term,
                    payments_per_year,
                    offer.interest_rate / 10000
                );
                doc_data_fields.payment_amount = `${formatter.format(periodic_payment_amount)}`
                doc_data_fields.payment_amount_2 = `${formatter.format(periodic_payment_amount)}`

                const apr = await calculateAPR(offer, periodic_payment_amount);
                doc_data_fields.apr = `${apr.toFixed(2)}%`;
                doc_data_fields.n_payments = (offer.term - 1);
                const finance_charge = (offer.interest_rate && offer.origination_fee === 0) 
                    ? (0) 
                    : (offer.term * periodic_payment_amount) - (offer.amount / 100); // for zero interest, we want to avoid rounding to non zero fin charge
                doc_data_fields.finance_charge = `${formatter.format(finance_charge)}`; 
                const total_of_payments = (offer.interest_rate && offer.origination_fee === 0)
                    ? (offer.amount / 100) 
                    : (offer.term * periodic_payment_amount); // for zero interest, we want to avoid rounding to non zero fin charge
                doc_data_fields.total_of_payments = `${formatter.format(total_of_payments)}`

                //const today2 =  moment().format("MM/DD/YYYY");
                const first_payment_date2 = payments_per_year === 12 
                    ? moment().add(1,'months').format("MM/DD/YYYY")
                    : moment().add(2,'weeks').format("MM/DD/YYYY");

                //const first_payment_date = moment().add(1,'months').format("MM/DD/YYYY");

                const payment_period_text = payments_per_year === 12 ? 'Monthly' : payments_per_year === 26 ? 'Biweekly' : 'Semi-monthly';
                const payments_due = `${payment_period_text} beginning ${first_payment_date2}`;
                doc_data_fields.payments_due = payments_due;
                const final_due_date = payments_per_year === 12
                    ? moment().add(offer.term,'months').format("MM/DD/YYYY")
                    : moment().add(offer.term * 2,'weeks').format("MM/DD/YYYY");
                
                doc_data_fields.final_payment_due = final_due_date;
                doc_data_fields.amount_to_you = `${formatter.format(offer.amount / 100)}`;
                doc_data_fields.total_financed = `${formatter.format(offer.amount / 100)}`;
                doc_data_fields.origination_fee = `${formatter.format(origination_fee_amount / 100)}`;
                doc_data_fields.total_loan_amount = `${formatter.format(offer.amount / 100 + origination_fee_amount / 100)}`;
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
                console.log('end of consumer loc case')
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

    // add custom fields
    if(templateId) {
        const pier_street_address = "575 Market Street, Suite 717"
        const pier_city_state_zip = "San Francisco, CA 94105"
        switch(templateId) {

            case "tpl_33T96QN3G54Mzars9r":
                // Goodcash custom LOC doc 
                doc_data_fields.pier_address = pier_street_address
                doc_data_fields.pier_city_state_zip = pier_city_state_zip
                doc_data_fields.pier_full_address = pier_street_address + ", " + pier_city_state_zip
                doc_data_fields.pier_address_2 = pier_street_address
                doc_data_fields.pier_city_state_zip_2 = pier_city_state_zip
                doc_data_fields.whitespace = undefined;
                doc_data_fields.origination_fee = undefined;
                doc_data_fields.annual_fee = undefined;
                doc_data_fields.account_number = undefined;
                break;
        }
    }
    return doc_data_fields;
}
                                                          

const generateDocspringStatementDataFields = (facility, borrower_details, nls_loan_details) => {
    // formats
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' } 
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        });

    const doc_data_fields = {};

    //////////////////////////
    // SUMMARY 
    //////////////////////////
    // top table
    doc_data_fields.statement_date = moment(facility.next_billing_date).format("MM/DD/YYYY");
    doc_data_fields.account_number = facility.account_number;
    doc_data_fields.loan_status = "In Repayment";
    doc_data_fields.loan_balance = `${formatter.format(facility.balance / 100)}`
    doc_data_fields.accrued_interest = `${formatter.format(nls_loan_details.paymentDetails.Next_Interest_Due_Amount)}`
    doc_data_fields.interest_rate = `${facility.terms.interest_rate / 100}%`;
    doc_data_fields.scheduled_monthly_payment = `${formatter.format(facility.next_payment_amount / 100)}`
    doc_data_fields.past_due_amount = `${formatter.format(nls_loan_details.loanDetails.Total_Past_Due_Balance)}`
    doc_data_fields.fees = "$0.00"; // todo
    const total_payment_due = facility.next_payment_amount / 100 + nls_loan_details.loanDetails.Total_Past_Due_Balance;
    doc_data_fields.payment_due = `${formatter.format(total_payment_due)}`
    doc_data_fields.payment_due_date = moment(facility.next_payment_due_date).format("MM/DD/YYYY");

    // borrower details
    doc_data_fields.name1 = `${borrower_details.first_name} ${borrower_details.last_name}`
    doc_data_fields.street1 = `${borrower_details.address.line_1} ${borrower_details.address.line_2}`;
    doc_data_fields.city_state_zip1 = `${borrower_details.address.city}, ${borrower_details.address.state} ${borrower_details.address.zip}`;

    // customer service
    doc_data_fields.cs_account_number = `(Please reference your account number ${facility.account_number})`;
    doc_data_fields.cs_phone = "707-563-1563";
    doc_data_fields.cs_email = "customer-service@pier-finance.com";

    // set period start and end date
    var period_start = "";
    const today = process.env.NODE_ENV === 'development' ? moment(config.get('current_date')) : moment();
    // if it's the first (shortened) billing cycle, set start date to open date, else set it to last billing date
    if (today.isSameOrBefore(nls_loan_details.amortizationSchedule[1].Payment_Date, 'day')) {
        period_start = moment(nls_loan_details.loanDetails.Open_Date).format("M/D");
    } else {
        period_start = moment(nls_loan_details.loanDetails.Last_Billing_Date).format("M/D");
    }

    // set end date to billing date - 1
    const period_end = moment(facility.next_billing_date, pierFormats.shortDate).subtract(1, "days").format("M/D");
    


    ////////////////////////////
    // ACCOUNT ACTIVITY
    ////////////////////////////

    // Current period  
    var periodStats = {};
    Object.values(nls_loan_details.statistics).forEach(statData => {
        if (statData.Month_Number.toString() === today.format("YYYYMM")) {
            periodStats = statData
        }
    })
    doc_data_fields.statement_period = `${period_start} – ${period_end}`

    // Calculate total principal and interest payments in current period

    // Grab payments from last billing period
    const currentPaymentsList = Object.values(nls_loan_details.paymentHistory).filter(pmt => {
        // if pmt.Date_Paid is before today and on/after last billing date, filter out the payment
        const pmt_date = moment(pmt.Date_Paid);
        return (pmt_date.isSameOrAfter(nls_loan_details.loanDetails.Last_Billing_Date) && pmt_date.isBefore(today))
    })
    console.log('CURRENT PAYMENTS LIST')
    console.log(currentPaymentsList)

    var principalPaidSum = 0
    var interestPaidSum = 0
    currentPaymentsList.forEach(pmt => {
        if(pmt.Payment_Description === "Principal Payment") { principalPaidSum += pmt.Payment_Amount }
        if(pmt.Payment_Description === "Interest Payment") { interestPaidSum += pmt.Payment_Amount }
    })
    
    doc_data_fields.statement_period_starting_balance = `${formatter.format(periodStats.Loan_Balance_High)}`;
    doc_data_fields.statement_period_scheduled_principal_payments = `${formatter.format(principalPaidSum)}`;
    doc_data_fields.statement_period_scheduled_interest_payments = `${formatter.format(interestPaidSum)}`;
    doc_data_fields.statement_period_additional_principal_applied = "$0.00"
    doc_data_fields.statement_period_additional_interest_applied = "$0.00"
    doc_data_fields.statement_period_principal_adjustments = "$0.00"
    doc_data_fields.statement_period_fees = "$0.00"
    doc_data_fields.statement_period_ending_balance = `${formatter.format(facility.balance / 100)}`


    // YTD
    var ytdStats = {}
    const currentYear = process.env.NODE_ENV === 'development' ? moment(config.get('current_date')).year() : moment().year();
    Object.values(nls_loan_details.statistics).forEach(statData => {
        if (statData.Year_Number === currentYear && statData.Master_Record === 1 && statData.Month_Number === 0) {
            ytdStats = statData
        }
    })
    doc_data_fields.ytd_starting_balance = `${formatter.format(ytdStats.Loan_Balance_High)}`
    doc_data_fields.ytd_scheduled_principal_payments = `${formatter.format(ytdStats.Principal_Paid)}`
    doc_data_fields.ytd_scheduled_interest_payments = `${formatter.format(ytdStats.Interest_Paid)}`
    doc_data_fields.ytd_additional_principal_applied = "$0.00"
    doc_data_fields.ytd_additional_interest_applied = "$0.00"
    doc_data_fields.ytd_principal_adjustments = "$0.00"
    doc_data_fields.ytd_fees = "$0.00"
    doc_data_fields.ytd_ending_balance = `${formatter.format(facility.balance / 100)}`

    // Lifetime
    var lifetimeStats = {}
    Object.values(nls_loan_details.statistics).forEach(statData => {
        if (statData.Year_Number === 0 && statData.Master_Record === 0 && statData.Month_Number === 0) {
            lifetimeStats = statData
            
        }
    })
    doc_data_fields.lifetime_starting_balance = `${formatter.format(facility.terms.amount / 100)}`
    doc_data_fields.lifetime_scheduled_principal_payments = `${formatter.format(lifetimeStats.Principal_Paid)}`
    doc_data_fields.lifetime_scheduled_interest_payments = `${formatter.format(lifetimeStats.Interest_Paid)}`
    doc_data_fields.lifetime_additional_principal_applied = "$0.00"
    doc_data_fields.lifetime_additional_interest_applied = "$0.00"
    doc_data_fields.lifetime_principal_adjustments = "$0.00"
    doc_data_fields.lifetime_fees = "$0.00"
    doc_data_fields.lifetime_ending_balance = `${formatter.format(facility.balance / 100)}`


    ////////////////////////////
    // TRANSACTION TABLE
    ////////////////////////////

    // set period
    doc_data_fields.transaction_period = `${period_start} – ${period_end}`

    // Sort payments by date
    const sortedPaymentsList = currentPaymentsList.sort((a, b) => {
        return moment(a.Date_Paid).isBefore(moment(b.Date_Paid)) ? 1 : -1;
    })

    // combine principal, interest and total payment objects
    const combinedPayments = sortedPaymentsList.reduce((acc, curr) => {
        if (!acc[curr.Transaction_Reference_No]) {
            acc[curr.Transaction_Reference_No] = { Transaction_Reference_No: curr.Transaction_Reference_No, objects: [] };
          }
          acc[curr.Transaction_Reference_No].objects.push(curr);
          return acc;
        }, {});

    console.log('combined payments:')
    console.log(combinedPayments)
    
    var pmtIndex = 1 // need this to map transactions to correct docspring txn rom
    // loop through each payment trio
    Object.values(combinedPayments).forEach(pmt => {
        // create the txn
        var txn = {}
        // set doc data fields
        pmt.objects.forEach(pmtObj => {
            switch (pmtObj.Payment_Description) {
                case 'PAYMENT':
                    txn.date = moment(pmtObj.Date_Paid).format("MM/DD/YYYY")
                    txn.desc = "Scheduled Payment"
                    txn.total = `${formatter.format(pmtObj.Payment_Amount)}`
                    break;
                case 'Principal Payment':
                    txn.principal = `${formatter.format(pmtObj.Payment_Amount)}`
                    break;
                case 'Interest Payment':
                    txn.interest = `${formatter.format(pmtObj.Payment_Amount)}`
                    break;
                default:
                    break;
            }

            console.log('pmtObj:')
            console.log(pmtObj)
        })
        switch (pmtIndex) {
            case 1:
                doc_data_fields.t1_date = txn.date
                doc_data_fields.t1_desc = txn.desc
                doc_data_fields.t1_principal = txn.principal ? txn.principal : "$0.00"
                doc_data_fields.t1_interest = txn.interest ? txn.interest : "$0.00"
                doc_data_fields.t1_total = txn.total ? txn.total : "$0.00"
                break;
            case 2:
                doc_data_fields.t2_date = txn.date
                doc_data_fields.t2_desc = txn.desc
                doc_data_fields.t2_principal = txn.principal ? txn.principal : "$0.00"
                doc_data_fields.t2_interest = txn.interest ? txn.interest : "$0.00"
                doc_data_fields.t2_total = txn.total ? txn.total : "$0.00"
                break;
            case 3:
                doc_data_fields.t3_date = txn.date
                doc_data_fields.t3_desc = txn.desc
                doc_data_fields.t3_principal = txn.principal ? txn.principal : "$0.00"
                doc_data_fields.t3_interest = txn.interest ? txn.interest : "$0.00"
                doc_data_fields.t3_total = txn.total ? txn.total : "$0.00"
                break;
            case 4:
                doc_data_fields.t4_date = txn.date
                doc_data_fields.t4_desc = txn.desc
                doc_data_fields.t4_principal = txn.principal ? txn.principal : "$0.00"
                doc_data_fields.t4_interest = txn.interest ? txn.interest : "$0.00"
                doc_data_fields.t4_total = txn.total ? txn.total : "$0.00"
                break;
            case 5:
                doc_data_fields.t5_date = txn.date
                doc_data_fields.t5_desc = txn.desc
                doc_data_fields.t5_principal = txn.principal ? txn.principal : "$0.00"
                doc_data_fields.t5_interest = txn.interest ? txn.interest : "$0.00"
                doc_data_fields.t5_total = txn.total ? txn.total : "$0.00"
                break;

            default:
                break;
        }
        pmtIndex++
    })

    ////////////////////////////
    // BOTTOM AMOUNT DUE
    ////////////////////////////

    // borrower details
    doc_data_fields.name2 = `${borrower_details.first_name} ${borrower_details.last_name}`
    doc_data_fields.street2 = `${borrower_details.address.line_1} ${borrower_details.address.line_2}`;
    doc_data_fields.city_state_zip2 = `${borrower_details.address.city}, ${borrower_details.address.state} ${borrower_details.address.zip}`;
    doc_data_fields.due_amount = `${formatter.format(total_payment_due)}`

    // table
    doc_data_fields.account_number2 = `Account Number: ${facility.account_number}`;
    doc_data_fields.due_by = moment(facility.next_payment_due_date).format("MM/DD/YYYY");
    console.log(`doc_data_fields: ${JSON.stringify(doc_data_fields)}`)
    return doc_data_fields
}



// Loan doc templates (note: currently don't include statement template ids here)
const docspringTemplates = {
    consumer_installment_loan: "tpl_CxaCsG7LtLH9Jksez2",
    consumer_bnpl: "tpl_eyyPPRERjTyn2Z4QJy",
    consumer_revolving_line_of_credit: "tpl_m5cpPsgcqxk2RzM2cN",
    consumer_closed_line_of_credit: "",
    commercial_installment_loan: "",
    commercial_bnpl: "",
    commercial_revolving_line_of_credit: "tpl_CbSMf49ckCdT6fLNYh",
    commercial_closed_line_of_credit: "",
    statements: {
        consumer_installment_loan: "tpl_PLeJtENcqXZgGQEP9a",
        consumer_bnpl: "tpl_PLeJtENcqXZgGQEP9a"
    }
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
    generateDocspringStatementDataFields,
    createDocSpringSubmission,
    getDocSpringSubmission
}