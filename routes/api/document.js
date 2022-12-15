const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const Business = require('../../models/Business');
const router = express.Router();
const Document = require('../../models/Document');
const config = require('config');
const request = require('request');
const Application = require('../../models/Application');


// @route     POST document
// @desc      Create a loan agreement pdf for user
// @access    Public
router.post('/loan_agreement', [auth], async (req, res) => {
    try {

        // get application and borrower info
        const { application_id } = req.body
        const application = await Application.findOne({ application_id });
        if(!application || application.client_id !== req.client_id) {
            return res.status(404).json({ msg: "Application not found"});
        }
        if(application.status !== 'approved') {
            return res.status(404).json({ msg: "Loan document can only be generated for an approved application"});
        }
        const borrower = await Business.findOne({ borrower_id: application.borrower_id})     

        // create docspring submission with applicant data
        const username = config.get('docspring-id');
        const pw = config.get('docspring-secret');
        const auth = 'Basic ' + Buffer.from(username + ':' + pw).toString('base64');
        const header = {'user-agent': 'node.js', 'Authorization': auth}
        
        const offer = application.offer
        const address_line_2 = borrower.address.line_2 ?? ""
        const doc_data_fields = {}
        doc_data_fields.account_number = `${application_id}`;
        doc_data_fields.credit_limit = `$${offer.amount / 100}.00`;
        doc_data_fields.apr = `${offer.interest_rate / 100}%`;
        doc_data_fields.late_payment_fee = `$${offer.late_payment_fee / 100}.00`;
        doc_data_fields.entity_name = `${borrower.business_name}`;
        doc_data_fields.entity_type = `${borrower.business_type}`;
        doc_data_fields.ein = `${borrower.ein}`;
        doc_data_fields.address = `${borrower.address.line_1} ${borrower.address.line_2} ${borrower.address.city} ${borrower.address.state} ${borrower.address.zip}`;
        doc_data_fields.phone = `${borrower.phone}`;
        doc_data_fields.officer_name = `${borrower.business_contact.first_name} ${borrower.business_contact.last_name}`;
        doc_data_fields.officer_title = `${borrower.business_contact.title}`;
        doc_data_fields.officer_address = `${borrower.address.line_1} ${address_line_2} ${borrower.address.city} ${borrower.address.state} ${borrower.address.zip}`;

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
                return res.status(404).json({ msg: "Document creation failed. Please retry"})
            }

            const submission_id = body_json.submission.id

            const options = {
                url: `https://api.docspring.com/api/v1/submissions/${submission_id}`,
                method: 'GET',
                headers: header,
            };
    
            request(options, (err, response, body) => {
                if(res.statusCode !== 200) {
                    return res.status(404).json({ msg: "Document creation failed. Please retry"});
                }
                const get_body_json = JSON.parse(body)
                const doc_url = get_body_json.download_url
                const document_id = 'doc_' + uuidv4().replace(/-/g, '');
                const loan_document = new Document({
                    application_id: application_id,
                    document_id: document_id,
                    document_url: doc_url,
                    client_id: req.client_id

                })
                loan_document.save()
                res.json(loan_document);
            });
            
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
    
});

// @route PATCH document
// @desc Sign loan agreement
// @access Public
router.patch('/loan_agreement/:id/sign', [auth], async (req, res) => {
    // change loan doc status to signed
    // add time stamp of signuate
    // update application status 
    try {
        let loan_agreement = await Document.findOne({ document_id: req.params.id });
        if(!loan_agreement || loan_agreement.client_id !== req.client_id) {
            return res.status(404).json({ msg: 'Document not found' })
        }
        if(loan_agreement.status !== 'pending_signature') {
            return res.status(404).json({ msg: 'Only documents with status pending_signature can be signed' });
        }
        loan_agreement.signature_timestamp = Date.now()
        loan_agreement.status = "signed"
        await loan_agreement.save();

        let application = await Application.findOne({ application_id: loan_agreement.application_id })
        application.status = 'accepted'
        await application.save()

        res.json(loan_agreement)
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
})

// @route     GET document by id
// @desc      Retrieve a document's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    try {
        const document = await Document.findOne({ document_id: req.params.id });
        if(!document || document.client_id !== req.client_id) {
            return res.status(404).json({ msg: 'Document not found' });
        }
        res.json(document);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Document id does not exist' });
        }
        res.status(500).send('Server Error');
    }
})

// @route     GET all documents
// @desc      List all documents
// @access    Public
router.get('/', [auth], async (req, res) => {
    try {
        const documents = await Document.find({ client_id: req.client_id });
        res.json(documents);
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})

module.exports = router;