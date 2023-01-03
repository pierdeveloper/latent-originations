
const { getError } = require('../../helpers/errors.js');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const Business = require('../../models/Business');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Document = require('../../models/Document');
const config = require('config');
const request = require('request');
const Application = require('../../models/Application');


// @route     POST document
// @desc      Create a loan agreement pdf for user
// @access    Public
router.post('/', [auth], async (req, res) => {
    try {

        // get application and borrower info
        const { application_id } = req.body
        const application = await Application.findOne({ id: application_id });
        if(!application || application.client_id !== req.client_id) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })

        }
        if(application.status !== 'APPROVED') {
            const error = getError("document_cannot_be_created")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        let borrower = await Borrower.findOne({ id: application.borrower_id })
        if(!borrower || borrower.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // for business applicant
        if(borrower.type === 'business') {
            const business = await Business.findOne({ id: application.borrower_id})     

            // create docspring submission with applicant data
            const username = config.get('docspring-id');
            const pw = config.get('docspring-secret');
            const auth = 'Basic ' + Buffer.from(username + ':' + pw).toString('base64');
            const header = {'user-agent': 'node.js', 'Authorization': auth}
            
            const offer = application.offer
            const address_line_2 = business.address.line_2 ?? ""
            const doc_data_fields = {}
            doc_data_fields.account_number = `${application_id}`;
            doc_data_fields.credit_limit = `$${offer.amount / 100}.00`;
            doc_data_fields.apr = `${offer.interest_rate / 100}%`;
            doc_data_fields.late_payment_fee = `$${offer.late_payment_fee / 100}.00`;
            doc_data_fields.entity_name = `${business.business_name}`;
            doc_data_fields.entity_type = `${business.business_type}`;
            doc_data_fields.ein = `${business.ein}`;
            doc_data_fields.address = `${business.address.line_1} ${business.address.line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;
            doc_data_fields.phone = `${business.phone}`;
            doc_data_fields.officer_name = `${business.business_contact.first_name} ${business.business_contact.last_name}`;
            doc_data_fields.officer_title = `${business.business_contact.title}`;
            doc_data_fields.officer_address = `${business.address.line_1} ${business.address_line_2} ${business.address.city} ${business.address.state} ${business.address.zip}`;

            const body_params = {
                data: doc_data_fields,
                test: true,
                editable: false
            }

            const post_options = {
                url: `https://api.docspring.com/api/v1/templates/tpl_33P5mxxNPj26TzYQK5/submissions`,
                method: 'POST',
                headers: header,
                body: JSON.stringify(body_params)
            }

            request(post_options, (err, response, body) => {
                const body_json = JSON.parse(body)
                if(body_json.status !== "success") {
                    const error = getError("document_creation_failed")
                    return res.status(error.error_status).json({ 
                        error_type: error.error_type,
                        error_code: error.error_code,
                        error_message: error.error_message
                    })
                }

                const submission_id = body_json.submission.id

                const options = {
                    url: `https://api.docspring.com/api/v1/submissions/${submission_id}`,
                    method: 'GET',
                    headers: header,
                };

                var waitTill = new Date(new Date().getTime() + 4 * 1000);
                while(waitTill > new Date()){}
        
                request(options, (err, response, body) => {
                    if(res.statusCode !== 200) {
                        const error = getError("document_creation_failed")
                        return res.status(error.error_status).json({ 
                            error_type: error.error_type,
                            error_code: error.error_code,
                            error_message: error.error_message
                        })
                    }
                    const get_body_json = JSON.parse(body)
                    const doc_url = get_body_json.download_url
                    const loan_agreement_id = 'doc_' + uuidv4().replace(/-/g, '');
                    const loan_document = new Document({
                        application_id: application_id,
                        id: loan_agreement_id,
                        document_url: doc_url,
                        client_id: req.client_id

                    })
                    loan_document.save()
                    res.json(loan_document);
                });
                
            });
        } else {
            // for consumer applicants
            const consumer = await Consumer.findOne({ id: application.borrower_id})     

            // create docspring submission with applicant data
            const username = config.get('docspring-id');
            const pw = config.get('docspring-secret');
            const auth = 'Basic ' + Buffer.from(username + ':' + pw).toString('base64');
            const header = {'user-agent': 'node.js', 'Authorization': auth}
            
            const offer = application.offer
            const address_line_2 = consumer.address.line_2 ?? ""
            const credit_limit = (offer.amount / 100).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD'
            })
            const doc_data_fields = {}
            doc_data_fields.account_number = `${application_id}`;
            doc_data_fields.credit_limit = credit_limit;
            doc_data_fields.apr = `${offer.interest_rate / 100}%`;
            doc_data_fields.late_payment_fee = `$${offer.late_payment_fee / 100}.00`;
            doc_data_fields.name = `${consumer.first_name} ${consumer.last_name}`;
            doc_data_fields.address = `${consumer.address.line_1} ${consumer.address.line_2} ${consumer.address.city} ${consumer.address.state} ${consumer.address.zip}`;
            doc_data_fields.email = `${consumer.email}`;
            
            const body_params = {
                data: doc_data_fields,
                test: true,
                editable: false
            }

            const post_options = {
                url: `https://api.docspring.com/api/v1/templates/tpl_4zqGxezHzrfqDaxGr2/submissions`,
                method: 'POST',
                headers: header,
                body: JSON.stringify(body_params)
            }

            request(post_options, (err, response, body) => {
                const body_json = JSON.parse(body)
                if(body_json.status !== "success") {
                    const error = getError("document_creation_failed")
                    return res.status(error.error_status).json({ 
                        error_type: error.error_type,
                        error_code: error.error_code,
                        error_message: error.error_message
                    })
                }

                const submission_id = body_json.submission.id
                console.log(`submission_id is ${submission_id}`)
                const options = {
                    url: `https://api.docspring.com/api/v1/submissions/${submission_id}`,
                    method: 'GET',
                    headers: header,
                };
                var waitTill = new Date(new Date().getTime() + 4 * 1000);
                while(waitTill > new Date()){}
        
                request(options, (err, response, body) => {
                    console.log('requesting document url)')
                    if(res.statusCode !== 200) {
                        const error = getError("document_creation_failed")
                        return res.status(error.error_status).json({ 
                            error_type: error.error_type,
                            error_code: error.error_code,
                            error_message: error.error_message
                        })
                    }
                    const get_body_json = JSON.parse(body)
                    const doc_url = get_body_json.download_url
                    const loan_agreement_id = 'doc_' + uuidv4().replace(/-/g, '');
                    const loan_document = new Document({
                        application_id: application_id,
                        id: loan_agreement_id,
                        document_url: doc_url,
                        client_id: req.client_id

                    })
                    loan_document.save()
                    res.json(loan_document);
                });
                
            });
        }

    } catch (err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
    
});

// @route PATCH document
// @desc Sign loan agreement
// @access Public
router.post('/:id/sign', [auth], async (req, res) => {
    // change loan doc status to signed
    // add time stamp of signuate
    // update application status 
    try {
        let loan_agreement = await Document.findOne({ id: req.params.id });
        if(!loan_agreement || loan_agreement.client_id !== req.client_id) {
            const error = getError("document_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        if(loan_agreement.status !== 'PENDING_SIGNATURE') {
            const error = getError("document_cannot_be_signed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        loan_agreement.signature_timestamp = Date.now()
        loan_agreement.status = "SIGNED"
        await loan_agreement.save();

        let application = await Application.findOne({ id: loan_agreement.application_id })
        application.status = 'ACCEPTED'
        await application.save()

        loan_agreement = await Document.findOne({ id: req.params.id })
            .select('-_id -__v -client_id')
        res.json(loan_agreement)
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
    try {
        const documents = await Document.find({ client_id: req.client_id })
            .select('-_id -__v -client_id');
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