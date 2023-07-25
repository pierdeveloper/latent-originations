const { getError } = require('../../helpers/errors.js');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const Business = require('../../models/Business');
const router = express.Router();
const Borrower = require('../../models/Borrower');
const Document = require('../../models/Document');
const { getDocSpringSubmission, 
    createDocSpringSubmission, 
    generateDocspringDataFields, 
    docspringTemplates } = require('../../helpers/docspring.js')
const {Application, LoanOffer, LineOfCreditOffer} = require('../../models/Application');
const Customer = require('../../models/Customer.js');
const { createFacility } = require('../../helpers/facilities.js');
const { validationResult, check } = require('express-validator');
const { loanAgreementValidationRules } = require('../../helpers/validator.js');


const applyRequestValidationRules = async (req, res, next) => {
    // in the future, check application type and customer config to determine which rules to apply
    const customer = await Customer.findOne({ client_id: req.client_id })
    const use_single_offer = customer.legacy_single_application_offer_supported ? true : false

    // set accepted_offer_id if use_single_offer is true
    if(use_single_offer) {
        const application = await Application.findOne({ id: req.body.application_id })
        req.body.accepted_offer_id = application.offer.id
    }

    let rules = []
    rules = [...rules, ...loanAgreementValidationRules()]
    if(!use_single_offer) {
        const validation_rule = check('accepted_offer_id', 'offer_id is missing or invalid').isString().notEmpty().isLength({max: 100})
        rules = [...rules, validation_rule]
    }

    let i = 0;
    const runNextRule = () => {
        if (i < rules.length) {
          rules[i](req, res, runNextRule);
          i += 1;
        } else {
          next();
        }
      };
    
      runNextRule();
  }

// @route     POST document
// @desc      Create a loan agreement pdf for user
// @access    Public
router.post('/', [auth, applyRequestValidationRules], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // validate offer params
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "APPLICATION_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    try {
        // get application and borrower info
        const { application_id, accepted_offer_id } = req.body;
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
        if(process.env.NODE_ENV !== 'development') {
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
        }

        // Check that borrower exists
        let borrower = await Borrower.findOne({ id: application.borrower_id })
        if(!borrower || borrower.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Check that the product is supported
        if(['consumer_closed_line_of_credit', 'commercial_closed_line_of_credit', 
            'commercial_installment_loan', 'commercial_bnpl'].includes(application.credit_type)) {
            const error = getError("unsupported_product")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        
        // get client to check if they have loan_doc_template override set
        const client = await Customer.findOne({client_id: client_id});

        // get accepted offer
        var accepted_offer = {}
        switch(application.credit_type) {
            case 'consumer_installment_loan':
            case 'consumer_bnpl':
                accepted_offer = await LoanOffer.findOne({ id: accepted_offer_id })
                break;
            case 'consumer_revolving_line_of_credit':
                accepted_offer = await LineOfCreditOffer.findOne({ id: accepted_offer_id })
                break;
            default: break;
        }
        console.log(`accepted_offer: ${accepted_offer}`)

        const is_custom_loan_doc = client.custom_loan_agreement.enabled;
        
        // Generate docspring data fields
        var docspringBorrower = {}
        if(borrower.type === 'business') {
            docspringBorrower = await Business.findOne({ id: application.borrower_id}) 
        } else {
            docspringBorrower = await Consumer.findOne({ id: application.borrower_id})  
        }

        const template_id = is_custom_loan_doc ? client.custom_loan_agreement.template_id :
            docspringTemplates[application.credit_type] 

        const doc_data_fields = await generateDocspringDataFields(borrower.type, docspringBorrower, application, accepted_offer, false, template_id)
        
        console.log(`template_id: ${template_id}`)
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
        console.log(docspring_pending_submission.submission.id)      

        // Artificial latency for ds to prepare submission
        var waitTill = new Date(new Date().getTime() + 3 * 1000);
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
        const loan_agreement_id = 'doc_' + uuidv4().replace(/-/g, '');
        console.log('here we are!')
        console.log(application_id)
        console.log(loan_agreement_id)
        console.log(doc_url)
        console.log(req.client_id)
        console.log(unsigned_submission_id)
        console.log('creating and saving doc to mongo..')
        // Create loan agreement and save
        
        let loan_document = new Document({
            application_id: application_id,
            id: loan_agreement_id,
            document_url: doc_url,
            client_id: req.client_id,
            unsigned_submission_id,
            accepted_offer_id
        })
        await loan_document.save()
        console.log('saved doc to mongo')
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


// @route POST document
// @desc Sign loan agreement
// @access Public
router.post('/:id/sign', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const client_id = req.client_id

        // Confirm existing loan agreement exists
        let loan_agreement = await Document.findOne({ id: req.params.id });
        if(!loan_agreement || loan_agreement.client_id !== client_id) {
            const error = getError("document_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        const accepted_offer_id = loan_agreement.accepted_offer_id

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

        // get client to check if they have loan_doc_template override set
        const client = await Customer.findOne({client_id: client_id});

        // get accepted offer
        var accepted_offer = {}
        switch(application.credit_type) {
            case 'consumer_installment_loan':
            case 'consumer_bnpl':
                accepted_offer = await LoanOffer.findOne({ id: accepted_offer_id })
                break;
            case 'consumer_revolving_line_of_credit':
                accepted_offer = await LineOfCreditOffer.findOne({ id: accepted_offer_id })
                break;
            default: break;
        }
        console.log(`accepted_offer: ${accepted_offer}`)

        const is_custom_loan_doc = client.custom_loan_agreement.enabled;

        // Generate docspring data fields
        var docspringBorrower = {}
        if(borrower.type === 'business') {
            docspringBorrower = await Business.findOne({ id: application.borrower_id}) 
        } else {
            docspringBorrower = await Consumer.findOne({ id: application.borrower_id})  
        }
        const template_id = is_custom_loan_doc ? client.custom_loan_agreement.template_id :
            docspringTemplates[application.credit_type] 

        const doc_data_fields = await generateDocspringDataFields(borrower.type, docspringBorrower, application, accepted_offer, true, template_id)

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
        var waitTill = new Date(new Date().getTime() + 3 * 1000);
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

        // if facility_autocreate is true, create facility
        if (client.facility_autocreate) {
            console.log('auto creating facility for this customer')
            createFacility(loan_agreement.id, client_id, true)    
        }
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