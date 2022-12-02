const express = require('express');
const router = express.Router();
const Application = require('../../models/Application');

// @route     POST application
// @desc      Create a credit application
// @access    Public
router.post('/', async (req, res) => {
    
    try {
        const { business_id, credit_type  } = req.body

        let application = new Application({
            business_id,
            credit_type
        })
        
        await application.save()
        res.json(application);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
    
});


// @route PUT application
// @desc Approve credit application
// @access Public
router.put('/:id/approve', async (req, res) => {
    console.log('approve req received')

    const { offer } = req.body

    const offerFields = {};
    offerFields.amount = offer.amount,
    offerFields.interest_rate = offer.interest_rate,
    offerFields.repayment_frequency = offer.repayment_frequency,
    offerFields.interest_free_period = offer.interest_free_period,
    offerFields.is_revolving = offer.is_revolving,
    offerFields.late_payment_fee = offer.late_payment_fee

    console.log(offerFields.amount)


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

router.patch('/')

module.exports = router;