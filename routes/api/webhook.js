const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const Customer = require('../../models/Customer');
const config = require('config');
const { getError } = require('../../helpers/errors.js');
const { WebClient } = require('@slack/web-api');
const Payment = require('../../models/Payment');
const Facility = require('../../models/Facility');
const { postPaymentToNLS } = require('../../helpers/nls.js');

const moment = require('moment');
const { createNLSConsumer, createNLSLoan, retrieveNLSLoan, createNLSLineOfCredit, syncFacilityWithNLS } = require('../../helpers/nls.js');
const axios = require('axios');
const responseFilters = require('../../helpers/responseFilters.json');
const { response } = require('express');
const { bankDetailsValidationRules } = require('../../helpers/validator.js');
const Statement = require('../../models/Statement.js');


// @route     DOCSPRING WEBHOOKS
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.post('/docspring_258956nrd_889765', async (req, res) => {
    const { submission } = req.body;
    const submission_id = submission.id;
    const state = submission.state;
    const permanent_download_url = submission.permanent_download_url;
    console.log('received a webhook from docspring!')

    //webhookEventEmitter.emit('ds_submission'/*, {submission_id, state, permanent_download_url}*/);

    res.status(200).send("Webhook rec'd")
})


// where i'm leaving off
/*
status:
successfuly set up this endpoint to receive docspring webhook

next step:
implement event emitter in /loan_agreement create endpoint
confirm emitter is firing


*/

// @route     DWOLLA WEBHOOKS
// @desc      Dwolla event listener for ACH transfers
// @access    Public
router.post('/dwolla', async (req, res) => {
    console.log('received dwolla webhook!')
    console.log(req.body)
    console.log(`dwolla topic: ${req.body.topic}`)
    const { topic, resourceId, timestamp } = req.body;

    switch (topic) {
        case 'customer_transfer_completed':
            console.log('running block for event: ' + topic)
            try {
                // pull up the payment with dwolla transfer id
                var payment = await Payment.findOne({ dwolla_transfer_id: resourceId });
                console.log('pulled up payment with dwolla transfer id: ' + resourceId)

                // check for error
                if(!payment) {
                    console.log('no payment found with this dwolla id')
                    break;
                }

                // confirm status of payment is pending
                if (payment.status !== 'processing') {
                    console.log('found payment but status is not processing')
                    break;
                }

                console.log(payment)
                // set payment status to settled
                payment.status = 'settled';
                await payment.save();

                // pull up assoicated facility
                const facility = await Facility.findOne({ id: payment.facility_id });

                // post payment to NLS (and sync)
                const nls_payment = await postPaymentToNLS(facility, payment);

                // check for error

                // sync facility with NLS
                const syncJob = await syncFacilityWithNLS(facility);

            } catch (error) {
                console.log('error caught in webhook block')
                break
            }
            
            // send slack notification
            if(process.env.NODE_ENV === 'production') {
                const slack = new WebClient(config.get('slack_bot_id'));
                (async () => {
                    try {
                        const greeting = 'Bonjour! A Dwolla payment has settled. Please transfer the funds to the client 🫡'
                        const result = slack.chat.postMessage({
                            channel: '#payments',
                            text: greeting + '\n' + `*Event:* ${topic}` + '\n' + `*Dwolla Transfer id:* ${resourceId}` + '\n' + `*Timestamp:* ${timestamp}`
                        });
                    }
                    catch (error) { console.error(error); }
                })();
            }
            break;
    
        default:
            break;
    }
   
    // respond to dwolla
    res.status(200).send('Webhook received');
})

module.exports = router;