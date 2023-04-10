const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const Customer = require('../../models/Customer');
const config = require('config');
const { getError } = require('../../helpers/errors.js');
const { WebClient } = require('@slack/web-api');
//const { webhookEventEmitter } = require('../../server');


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
    const { topic, resourceId, timestamp } = req.body;

    if (topic === 'customer_transfer_completed' && process.env.NODE_ENV === 'production') {
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
   
    // respond to dwolla
    res.status(200).send('Webhook received');
})

module.exports = router;