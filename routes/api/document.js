const express = require('express');
const router = express.Router();
const Document = require('../../models/Document');

// @route     POST document
// @desc      Create a loan agreement pdf for user
// @access    Public
router.post('/loan_agreement', async (req, res) => {
    try {
        // ** WARNING: THIS IMPLEMENTATION DOES NOT TAKE INTO ACCOUNT ANY USER/APP info
        const { application_id } = req.body

        let loan_agreement = new Document({
            application_id
        });

        // WARNING! STATIC DOCUMENT URL
        loan_agreement.document_url = "https://storage.googleapis.com/pier-loan-agreements/PierLoanAgreement-14xj28l2B.pdf"

        await loan_agreement.save()
        res.json(loan_agreement)

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
    
});

// @route PUT document
// @desc Sign loan agreement
// @access Public
router.put('/loan_agreement/:id/sign', async (req, res) => {
    // change loan doc status to signed
    // add time stamp of signuate
    // update application status 
    try {
        let loan_agreement = await Document.findById(req.params.id);
        if(!loan_agreement) {
            return res.status(404).json({ msg: 'Document not found' })
        }
        loan_agreement.date_signed = Date.now()
        loan_agreement.status = "signed"
        await loan_agreement.save();
        res.json(loan_agreement)
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
})

module.exports = router;