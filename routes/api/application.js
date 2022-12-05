const express = require('express');
const router = express.Router();
const Application = require('../../models/Application');
const { validationResult } = require('express-validator');
const { applicationValidationRules, offerValidationRules } = require('../../helpers/validator.js');


// @route     POST application
// @desc      Create a credit application
// @access    Public
router.post('/', applicationValidationRules(), async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array()});
    }

    try {
        const { borrower_id, credit_type  } = req.body

        let application = new Application({
            borrower_id,
            credit_type
        })
        
        await application.save()
        res.json(application);

    } catch (err) {
        console.error(err);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Business id does not exist' });
        }
        res.status(500).send("Server Error");
    }
});


// @route PATCH application
// @desc Approve credit application
// @access Public
router.patch('/:id/approve', offerValidationRules(), async (req, res) => {

    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array()});
    }

    const { offer } = req.body

    const offerFields = {};
    offerFields.amount = offer.amount,
    offerFields.interest_rate = offer.interest_rate,
    offerFields.repayment_frequency = offer.repayment_frequency,
    offerFields.interest_free_period = offer.interest_free_period,
    offerFields.is_revolving = offer.is_revolving,
    offerFields.late_payment_fee = offer.late_payment_fee

    try {
        let application = await Application.findById(req.params.id);
        if (!application) {
            return res.status(404).json({ msg: 'Application not found' })
        }
        application.offer = offerFields
        application.status = 'approved'
        await application.save()
        res.json(application)
        
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
})

// @route     GET application by id
// @desc      Retrieve an application's details
// @access    Public
router.get('/:id', async (req, res) => {
    try {
        const application = await Application.findById(req.params.id);
        if(!application) {
            return res.status(404).json({ msg: 'Application not found' });
        }
        res.json(application);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Application id does not exist' });
        }
        res.status(500).send('Server Error');
    }
})

// @route     GET business borrowers
// @desc      List all business borrowers
// @access    Public
router.get('/', async (req, res) => {
    try {
        const applications = await Application.find();
        res.json(applications);
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})


module.exports = router;