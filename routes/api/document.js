const axios = require('axios').default;
const { getError } = require('../../helpers/errors.js');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const Business = require('../../models/Business');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Document = require('../../models/Document');
const config = require('config');
const Application = require('../../models/Application');
const moment = require('moment');


// @route     POST document
// @desc      Create a loan agreement pdf for user
// @access    Public
router.post('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {

        // get application and borrower info
        const { application_id } = req.body;
        const client_id = req.client_id;
        const application = await Application.findOne({ id: application_id });

        // verify it exists
        if(!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })

        }

        // check that the application status is approved
        if(application.status !== 'approved') {
            const error = getError("document_cannot_be_created")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // check that a live loan agreement doesn't already exist
        const existing_loan_agreement = await Document.findOne({
            application_id: application_id,
            status: "pending_signature"
        });
        if(existing_loan_agreement) {
            const error = getError("document_already_exists")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const offer = application.offer

        let borrower = await Borrower.findOne({ id: application.borrower_id })

        if(!borrower || borrower.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Prep docspring fields to be created
        const doc_data_fields = {}
        let template_id = ""

        // DS data fields for business
        if(borrower.type === 'business') {
            const business = await Business.findOne({ id: application.borrower_id})     
            const address_line_2 = business.address.line_2 ?? ""
            const today = new Date();
            const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' } 
            const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              });

            if(application.credit_type === 'installment_loan') {
                const error = getError("unsupported_product")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } else {
                doc_data_fields.date = today.toLocaleDateString('en-us', dateOptions);
                doc_data_fields.account_number = `${application_id}`;
                doc_data_fields.annual_fee = `${formatter.format(offer.annual_fee / 100)}`
                doc_data_fields.origination_fee = `${formatter.format(offer.origination_fee / 100)}`
                doc_data_fields.credit_limit = `${formatter.format(offer.amount / 100)}`;
                doc_data_fields.apr = `${offer.apr / 100}%`;
                doc_data_fields.late_payment_fee = `${formatter.format(offer.late_payment_fee / 100)}`;
                doc_data_fields.entity_name = `${business.business_name}`;
                doc_data_fields.entity_type = `${business.business_type}`;
                doc_data_fields.ein = `${business.ein}`;
                doc_data_fields.address = `${business.address.line_1} ${business.address.line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;
                doc_data_fields.phone = `${business.phone}`;
                doc_data_fields.officer_name = `${business.business_contact.first_name} ${business.business_contact.last_name}`;
                doc_data_fields.officer_title = `${business.business_contact.title}`;
                doc_data_fields.officer_address = `${business.address.line_1} ${business.address_line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;
                doc_data_fields.officer_name_2 = " ";
                doc_data_fields.officer_title_2 = " ";
                doc_data_fields.entity_name_2 = " ";
                doc_data_fields.signature_date = " ";
                doc_data_fields.signature = " ";
                doc_data_fields.whitespace = true;

                template_id = "tpl_CbSMf49ckCdT6fLNYh";
            }
        
        } else {
            // DS data fields for consumer
            const consumer = await Consumer.findOne({ id: application.borrower_id})     
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
            doc_data_fields.name_2 = " ";
            doc_data_fields.date_2 = " ";
            doc_data_fields.signature = " ";
            
            // if loan
            if(application.credit_type === "installment_loan") {
                doc_data_fields.address = `${consumer.address.line_1} ${address_line_2}`;
                doc_data_fields.city_state_zip = `${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
                // payment amount
                const periodic_payment_amount = calculate_periodic_payment(
                    offer.amount / 100,
                    offer.term,
                    12,
                    offer.interest_rate / 10000
                ).toFixed(2);
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
                template_id = 'tpl_CxaCsG7LtLH9Jksez2';
                console.log('logging doc data fields')
                console.log(doc_data_fields);
            // if line of credit
            } else {
                doc_data_fields.email = `${consumer.email}`;
                doc_data_fields.address = `${consumer.address.line_1} ${address_line_2} ${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
                doc_data_fields.account_number = `${application_id}`;
                doc_data_fields.late_payment_fee = `${formatter.format(offer.late_payment_fee / 100)}`;
                doc_data_fields.annual_fee = `${formatter.format(offer.annual_fee / 100)}`
                doc_data_fields.origination_fee = `${formatter.format(offer.origination_fee / 100)}`
                doc_data_fields.whitespace = true;
                template_id = "tpl_m5cpPsgcqxk2RzM2cN";
            }

        }

        // Create DS submission
        const docspring_pending_submission = await createDocSpringSubmission(template_id, doc_data_fields)
        
        // If it's not created properly then error
        if(docspring_pending_submission.status !== "success") {
            const error = getError("document_creation_failed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // Artificial latency for ds to prepare submission
        var waitTill = new Date(new Date().getTime() + 4 * 1000);
        while(waitTill > new Date()){}

        // Get the submission
        const unsigned_submission_id = docspring_pending_submission.submission.id
        const docspring_submission = await getDocSpringSubmission(unsigned_submission_id)
        const doc_url = docspring_submission.permanent_download_url

        // If doc doesn't have a url then error
        if (doc_url === null) {
            const error = getError("document_creation_failed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Create loan agreement and save
        const loan_agreement_id = 'doc_' + uuidv4().replace(/-/g, '');
        let loan_document = new Document({
            application_id: application_id,
            id: loan_agreement_id,
            document_url: doc_url,
            client_id: req.client_id,
            unsigned_submission_id
        })
        await loan_document.save()

        // Response
        loan_document = await Document.findOne({ id: loan_agreement_id, client_id })
            .select('-_id -__v -client_id -unsigned_submission_id');
        
        console.log(loan_document); 
        res.json(loan_document);

    } catch (err) {
        console.log(err.error)
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
    
});


/*
    DOC SPRING HELPERS
*/
const createDocSpringSubmission = async (template_id, doc_data_fields) => {
    // create docspring submission with applicant data
    console.log('running docspring creation job')

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
    return response.data;
  }

  const getDocSpringSubmission = async (submission_id) => {
    console.log('running docspring fetch job');
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

const calculate_periodic_payment = (amount, n_payments, payments_per_year, apr) => {
    const i = apr/payments_per_year;
    const a = amount;
    const n = n_payments;
    const periodic_payment = a / (((1+i)**n)-1) * (i*(1+i)**n);
    console.log(i);
    console.log(a);
    console.log(n);
    console.log(`per pay formula yielding: ${periodic_payment}`)
    return periodic_payment;
}

// @route POST document
// @desc Sign loan agreement
// @access Public
router.post('/:id/sign', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {

        // Confirm existing loan agreement exists
        let loan_agreement = await Document.findOne({ id: req.params.id });
        if(!loan_agreement || loan_agreement.client_id !== req.client_id) {
            const error = getError("document_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Confirm loan agreement can be signed
        if(loan_agreement.status !== 'pending_signature') {
            const error = getError("document_cannot_be_signed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Pull up relevant application
        let application = await Application.findOne({ id: loan_agreement.application_id })

        const offer = application.offer;

        // Pull up relevant borrower
        const borrower = await Borrower.findOne({ id: application.borrower_id })
        
        // Prep docspring fields to be created
        const doc_data_fields = {}
        let template_id = ""

        // DS data fields for business
        if(borrower.type === 'business') {
            const business = await Business.findOne({ id: application.borrower_id})     
            const address_line_2 = business.address.line_2 ?? ""
            const today = new Date();
            const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' } 
            const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              });

            doc_data_fields.date = today.toLocaleDateString('en-us', dateOptions);
            doc_data_fields.account_number = `${application.id}`;
            doc_data_fields.annual_fee = `${formatter.format(offer.annual_fee / 100)}`
            doc_data_fields.origination_fee = `${formatter.format(offer.origination_fee / 100)}`
            doc_data_fields.credit_limit = `${formatter.format(offer.amount / 100)}`;
            doc_data_fields.apr = `${offer.apr / 100}%`;
            doc_data_fields.late_payment_fee = `${formatter.format(offer.late_payment_fee / 100)}`;
            doc_data_fields.entity_name = `${business.business_name}`;
            doc_data_fields.entity_type = `${business.business_type}`;
            doc_data_fields.ein = `${business.ein}`;
            doc_data_fields.address = `${business.address.line_1} ${business.address.line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;
            doc_data_fields.phone = `${business.phone}`;
            doc_data_fields.officer_name = `${business.business_contact.first_name} ${business.business_contact.last_name}`;
            doc_data_fields.officer_title = `${business.business_contact.title}`;
            doc_data_fields.officer_address = `${business.address.line_1} ${business.address_line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;
            doc_data_fields.officer_name_2 = `${business.business_contact.first_name} ${business.business_contact.last_name}`;
            doc_data_fields.officer_title_2 = `${business.business_contact.title}`;
            doc_data_fields.entity_name_2 = `${business.business_name}`;
            doc_data_fields.signature_date = today.toLocaleDateString('en-us', dateOptions);
            doc_data_fields.signature = `${business.business_contact.first_name} ${business.business_contact.last_name}`;
            doc_data_fields.whitespace = true;

            template_id = "tpl_CbSMf49ckCdT6fLNYh";
        
        } else {
            // DS data fields for consumer
            // for consumer applicants for LOC
            // DS data fields for consumer
            const consumer = await Consumer.findOne({ id: application.borrower_id})     
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
            doc_data_fields.name_2 = `${consumer.first_name} ${consumer.last_name}`;
            doc_data_fields.date_2 = today.toLocaleDateString('en-us', dateOptions);
            doc_data_fields.signature = `${consumer.first_name} ${consumer.last_name}`;

            // if loan
            if(application.credit_type === "installment_loan") {
                doc_data_fields.address = `${consumer.address.line_1} ${address_line_2}`;
                doc_data_fields.city_state_zip = `${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
                // payment amount
                const periodic_payment_amount = calculate_periodic_payment(
                    offer.amount / 100,
                    offer.term,
                    12,
                    offer.interest_rate / 10000
                ).toFixed(2);
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
                template_id = 'tpl_CxaCsG7LtLH9Jksez2';
                console.log('logging doc data fields')
                console.log(doc_data_fields);
            // if line of credit
            } else {
                doc_data_fields.email = `${consumer.email}`;
                doc_data_fields.address = `${consumer.address.line_1} ${address_line_2} ${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
                doc_data_fields.account_number = `${application_id}`;
                doc_data_fields.late_payment_fee = `${formatter.format(offer.late_payment_fee / 100)}`;
                doc_data_fields.annual_fee = `${formatter.format(offer.annual_fee / 100)}`
                doc_data_fields.origination_fee = `${formatter.format(offer.origination_fee / 100)}`
                doc_data_fields.whitespace = true;
                template_id = "tpl_m5cpPsgcqxk2RzM2cN";
            }

        }

        // Create new signed DS submission
        const docspring_pending_submission = await createDocSpringSubmission(template_id, doc_data_fields)
        
        // If it's not created properly then error
        if(docspring_pending_submission.status !== "success") {
            const error = getError("document_creation_failed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // Artificial latency for ds to prepare submission
        var waitTill = new Date(new Date().getTime() + 4 * 1000);
        while(waitTill > new Date()){}

        // Get the submission
        const signed_submission_id = docspring_pending_submission.submission.id
        const docspring_submission = await getDocSpringSubmission(signed_submission_id)
        const doc_url = docspring_submission.permanent_download_url

        // If doc doesn't have a url then error
        if (doc_url === null) {
            const error = getError("document_creation_failed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // update loan agreement object
        loan_agreement.signature_timestamp = Date.now()
        loan_agreement.status = "signed"
        loan_agreement.document_url = doc_url
        loan_agreement.signed_submission_id = signed_submission_id;
        await loan_agreement.save();

        // update application
        application.status = 'accepted'
        await application.save()

        loan_agreement = await Document.findOne({ id: loan_agreement.id })
            .select('-_id -__v -client_id -unsigned_submission_id -signed_submission_id');
        
        console.log(loan_agreement); 
        res.json(loan_agreement);
    } catch(err) {
        console.error(err.message);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET document by id
// @desc      Retrieve a document's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const document = await Document.findOne({ id: req.params.id })
            .select('-_id -__v');
        if(!document || document.client_id !== req.client_id) {
            const error = getError("document_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        document.client_id = undefined;

        console.log(document); 
        res.json(document);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_document_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET all documents
// @desc      List all documents
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const documents = await Document.find({ client_id: req.client_id })
            .select('-_id -__v -client_id');
        
        console.log(documents); 
        res.json(documents);
    } catch(err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

module.exports = router;