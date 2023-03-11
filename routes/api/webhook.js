const express = require('express');
const auth = require('../../middleware/auth');
const router = express.Router();
const consumer_state_limits = require('../../helpers/coverage/consumer.json');
const commercial_state_limits = require('../../helpers/coverage/commercial.json');
const Customer = require('../../models/Customer');
const { getError } = require('../../helpers/errors.js');
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

// @route     DOCSPRING WEBHOOKS
// @desc      Retrieve list of commercial credit coverage by state
// @access    Public
router.post('/docspring_258956nrd_889765', async (req, res) => {
    const { submission } = req.body;
    const submission_id = submission.id;
    const state = submission.state;
    const permanent_download_url = submission.permanent_download_url;
    console.log('received a webhook from docspring!')

    eventEmitter.emit('docspring_submission', {submission_id, state, permanent_download_url});

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

module.exports = router;