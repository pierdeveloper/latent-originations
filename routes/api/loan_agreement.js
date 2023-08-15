const { getError } = require('../../errors.js');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const LoanAgreement = require('../../models/LoanAgreement');
const { getDocSpringSubmission, 
    createPDF } = require('../../services/docspring.js')
const {Application, LoanOffer} = require('../../models/Application');


// @route     POST document
// @desc      Create a loan agreement pdf for user
// @access    Public
router.post('/', [], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        // get application and borrower info
        const { application_id, offer_id } = req.body;
        const application = await Application.findOne({ id: application_id });

        // get accepted offer
        var accepted_offer = await LoanOffer.findOne({ id: offer_id })

        // create PDF
        const docspring_pdf_data = await createPDF(application, accepted_offer)
        
        // If it's not created properly then error
        if(docspring_pdf_data.status !== "success") {
            const error = getError("document_creation_failed")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }   

        // Artificial latency for ds to prepare submission
        var waitTill = new Date(new Date().getTime() + 5 * 1000);
        while(waitTill > new Date()){}

        // Get the submission
        const unsigned_submission_id = docspring_pdf_data.submission.id
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
        
        let loan_agreement = new LoanAgreement({
            application_id: application_id,
            id: loan_agreement_id,
            document_url: doc_url,
            unsigned_submission_id,
            accepted_offer_id: accepted_offer.id
        })

        await loan_agreement.save()
        console.log('saved doc to mongo')
        // Response
        
        console.log(loan_agreement); 
        res.json(loan_agreement);

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



// @route     GET document by id
// @desc      Retrieve a document's details
// @access    Public
router.get('/:id', [], async (req, res) => {
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







// -------------
// Below routs aren't needed
// -------------


// @route     GET all documents
// @desc      List all documents
// @access    Public
router.get('/', [], async (req, res) => {
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