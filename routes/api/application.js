const express = require('express');
const { getError } = require('../../errors.js');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const {Application, LoanOffer} = require('../../models/Application');
const { calculateAPRs } = require('../../services/nls.js');
const calculate_monthly_payment = require('../../helpers/monthly_payment.js');



// @route     POST application
// @desc      Create a credit application
// @access    Public
router.post('/', [], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {

        // create application id
        const application_id = 'app_' + uuidv4().replace(/-/g, '');

        // create application object
        const applicationFields = {}
        applicationFields.id = application_id;

        //let application = applicationFields
        let application = new Application(applicationFields);

        // save application to db
        await application.save()

        // respond with application
        console.log(application)
        res.json(application);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});


// @route POST applications/id/approve
// @desc Approve credit application
// @access Public
router.post('/:id/approve', [], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    const { 
        offers 
    } = req.body

    const offersList = []

    try {
        const application = await Application.findOne({ id: req.params.id});

        offers.forEach(offer => {
            offer.id = 'off_' + uuidv4().replace(/-/g, '');
            const loanOffer = new LoanOffer(offer)
            offersList.push(loanOffer)
        })

        // calculate and set periodic payment for each offer
        for(let i = 0; i < offersList.length; i++) {
            offersList[i].periodic_payment = calculate_monthly_payment(offersList[i]);
        }

        // calculate and set apr for each offer
        //await calculateAPRs(offersList)

        // save offers
        offersList.forEach(async offer => {
            await offer.save()
        })

        application.offers = offersList
        application.status = 'approved'
        application.decisioned_on = Date.now();
        
        // save application and respond
        await application.save()
        
        
        console.log(application);
        // save all offers from offersList to offer collection

        res.json(application)

   
    }
    catch(err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})










// ----------------
// Below routes aren't needed
// ----------------


// @route     GET application by id
// @desc      Retrieve an application's details
// @access    Public
router.get('/:id', [], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const application = await Application.findOne({ id: req.params.id })
        
        if(!application) {
            const error = getError("application_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        console.log(application);
        res.json(application);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_application_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET applications
// @desc      List all applications
// @access    Public
router.get('/', [], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const applications = await Application.find()
        
        console.log(applications);
        res.json(applications);
    } catch(err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})


module.exports = router;