const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const router = express.Router();
const Facility = require('../../models/Facility');
const Statement = require('../../models/Statement');
const Job = require('../../models/Job');
const moment = require('moment');
const config = require('config');
const responseFilters = require('../../helpers/responseFilters.json');
const { getDocSpringSubmission, 
    createDocSpringSubmission, 
    generateDocspringStatementDataFields, 
    docspringTemplates } = require('../../helpers/docspring.js');
const Consumer = require('../../models/Consumer.js');
const { retrieveNLSLoan } = require('../../helpers/nls.js');
const { WebClient } = require('@slack/web-api');
const pierFormats = require('../../helpers/formats.js');
const { generateStatement, runStatementGenerateJob } = require('../../helpers/statements.js');
 

// @route     GET statement by id
// @desc      Retrieve a statement
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const statement = await Statement.findOne({ id: req.params.id });
        if(!statement || statement.client_id !== req.client_id) {
            const error = getError("statement_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Response
        let statementResponse = await Statement.findOne({ id: statement.id, client_id: req.client_id })
            .select(responseFilters['statement'] + ' -client_id');
        res.json(statementResponse);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_statement_id")
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

// @route     GET statements
// @desc      List all statements 
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const statements = await Statement.find({ client_id: req.client_id })
            .select(responseFilters['statement'] + ' -client_id');

        console.log(statements); 
        res.json(statements);
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




///////////////////
// INTERNAL ROUTES
///////////////////////
 
 // @route    PATCH statements/generate
// @desc      Generate statements for all facilities
// @access    Private
router.patch('/generate', async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // verify admin key
    const { admin_key } = req.body
    if(admin_key !== config.get("pier_admin_key")) {
        return res.status(401).send('Unauthorized')
    }

    // pull in all facilities
    const facilities = await Facility.find({});

    runStatementGenerateJob(facilities)

    res.json({msg: 'Started statement generation job'})

})


 // @route    PATCH statements/generate/{id}
// @desc      Generate statement for a facility 
// @access    Private
router.patch('/generate/:id', async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // verify admin key
    const { admin_key } = req.body
    if(admin_key !== config.get("pier_admin_key")) {
        return res.status(401).send('Unauthorized')
    }

    // grab facility and check that it exists
    const facility = await Facility.findOne({ id: req.params.id });
    if(!facility) {
        return res.status(404).json({msg: 'facility not found'})
    }

    // generate statement
    const job = await generateStatement(facility)

    // respond
    if(job.status === "success") {
        res.status(200).json({msg: 'statement generated', statement: job.statement})
    } else if(job.status === "skipped") {
        res.status(400).json({status: job.status, msg: job.msg})
    } else if (job.status === 'error') {
        res.status(400).json({status: job.status, msg: job.msg})
    } else {
        res.status(500).json({msg: 'unexpected error generating statement'})
    }   
})



module.exports = router;
 