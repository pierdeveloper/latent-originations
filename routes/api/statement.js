const express = require('express');
const { getError } = require('../../helpers/errors.js');
const { v4: uuidv4 } = require('uuid');
const auth = require('../../middleware/auth');
const router = express.Router();
const Facility = require('../../models/Facility');
const Statement = require('../../models/Statement');
const moment = require('moment');
const config = require('config');
const responseFilters = require('../../helpers/responseFilters.json');
const { getDocSpringSubmission, 
    createDocSpringSubmission, 
    generateDocspringStatementDataFields, 
    docspringTemplates } = require('../../helpers/docspring.js');
const Consumer = require('../../models/Consumer.js');
const { retrieveNLSLoan } = require('../../helpers/nls.js');

 

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

    runStatementGenerateJob()

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

    const facility = await Facility.findOne({ id: req.params.id });
    console.log(facility)


    // skip unsupported credit types
    switch (facility.credit_type) {
        case 'consumer_revolving_line_of_credit':
        case 'commercial_installment_loan':
        case 'commercial_revolving_line_of_credit':
        case 'commercial_bnpl':
            console.log('Statements for this credit type not supported yet');
            res.status(400).json({msg: 'Statements for this credit type not supported yet'})
            break;
        default: break;
    }

    // check if billing date is today or in the past
    var next_statement_date = moment(facility.next_billing_date);
    //const today = moment();
    const today = process.env.NODE_ENV === 'development' ? moment(config.get('current_date')) : moment();

    if(next_statement_date.isSameOrBefore(today, 'day')) {
        console.log('need to generate statement!')
        console.log(facility);
        // todo: check that existing statement note already created
        // check that client config has statements enabled
        let customer = await Customer.findOne({client_id: facility.client_id });

        // pull in borrower details
        const borrower_details = await Consumer.findOne({id: facility.borrower_id});
        console.log(`borrower details: ${borrower_details}`)

        // pull in nls loan details
        const nls_loan_details = await retrieveNLSLoan(facility.nls_account_ref);
        console.log(`nls loan details: ${nls_loan_details}`)
        if(nls_loan_details === 'nls_error') { return res.status(500).json({msg: 'error retrieving nls loan details'}) }

        // Generate docspring data fields
        const statement_data_fields = generateDocspringStatementDataFields(facility, borrower_details, nls_loan_details)

        // Get template id
        const template_id = docspringTemplates.statements[facility.credit_type] 

        // Create DS submission
        const docspring_pending_submission = await createDocSpringSubmission(template_id, statement_data_fields)

        // If it's not created properly then error
        if(docspring_pending_submission.status !== "success") {
            console.log('error creating docspring statement submission')
            res.status(400).json({msg: 'error creating docspring statement submission'})
        }
        // log the submission id
        console.log('successful submission id:')
        console.log(docspring_pending_submission.submission.id)      

        // Artificial latency for ds to prepare submission
        var waitTill = new Date(new Date().getTime() + 3 * 1000);
        while(waitTill > new Date()){}

        // Get the submission
        const submission_id = docspring_pending_submission.submission.id
        const docspring_submission = await getDocSpringSubmission(submission_id)
        const statement_url = docspring_submission.permanent_download_url
        console.log(`statement url: ${statement_url}`)

        // If statement doesn't have a url then error
        if (statement_url === null) {
            console.log('error creating docspring statement submission')
            res.status(400).json({msg: 'error creating docspring statement submission'})
        }

        // Create statement and save
        const statement_id = 'stmt_' + uuidv4().replace(/-/g, '');
        const statement_date = moment(next_statement_date).format('YYYY/MM/DD')

        let statement = new Statement({
            id: statement_id,
            statement_date: statement_date,
            url: statement_url,
            facility_id: facility.id,
            ds_submission_id: submission_id,
            client_id: facility.client_id
        })
        await statement.save()

        console.log(`statement generated: ${statement}`)
        res.status(200).json({msg: 'statement generated', statement: statement})
                        
    } else {
        console.log('No statement required yet for this facility')
        res.status(400).json({msg: 'No statement required yet for this facility'})
    }   

    

})


// Statement generation job
const runStatementGenerateJob = async () => {
    try {
        // grab all facilities
        const facilities = await Facility.find();
        const errors = [];
        const skipped = [];
        var sync_count = 0;
        
        // loop thru each facility
        for (let i = 0; i < facilities.length; i++) {

            var facility = facilities[i];

            // skip unsupported credit types
            switch (facility.credit_type) {
                case 'consumer_revolving_line_of_credit':
                case 'commercial_installment_loan':
                case 'commercial_revolving_line_of_credit':
                case 'commercial_bnpl':
                    console.log('Statements for this credit type not supported yet. Skipping it');
                    skipped.push(facility.id)
                    continue;
                default: break;
            }

            // check if billing date is today or in the past
            var next_statement_date = moment(facility.next_billing_date);
            //const today = moment();
            const today = moment('2023/04/21');

            if(next_statement_date.isSameOrBefore(today, 'day')) {
                console.log('need to generate statement!')
                console.log(facility);
                // todo: check that existing statement note already created
                // check that client config has statements enabled
                let customer = await Customer.findOne({client_id: facility.client_id });

                // pull in borrower details
                const borrower_details = await Consumer.findOne({id: facility.borrower_id});
                console.log(`borrower details: ${borrower_details}`)

                // pull in nls loan details
                const nls_loan_details = await retrieveNLSLoan(facility.nls_account_ref);
                console.log(`nls loan details: ${nls_loan_details}`)

                // Generate docspring data fields
                const statement_data_fields = generateDocspringStatementDataFields(facility, borrower_details, nls_loan_details)

                // Get template id
                const template_id = docspringTemplates.statements[facility.credit_type] 

                // Create DS submission
                const docspring_pending_submission = await createDocSpringSubmission(template_id, statement_data_fields)

                // If it's not created properly then error
                if(docspring_pending_submission.status !== "success") {
                    console.log('error creating docspring statement submission')
                    errors.push(facility.facility_id)
                    break;
                }
                // log the submission id
                console.log('successful submission id:')
                console.log(docspring_pending_submission.submission.id)      

                // Artificial latency for ds to prepare submission
                var waitTill = new Date(new Date().getTime() + 3 * 1000);
                while(waitTill > new Date()){}

                // Get the submission
                const submission_id = docspring_pending_submission.submission.id
                const docspring_submission = await getDocSpringSubmission(submission_id)
                const statement_url = docspring_submission.permanent_download_url
                console.log(`statement url: ${statement_url}`)

                // If statement doesn't have a url then error
                if (statement_url === null) {
                    console.log('error creating docspring statement submission')
                    errors.push(facility.facility_id)
                    break;
                }

                // Create statement and save
                const statement_id = 'stmt_' + uuidv4().replace(/-/g, '');
                const statement_date = moment(next_statement_date).format('YYYY/MM/DD')

                let statement = new Statement({
                    id: statement_id,
                    statement_date: statement_date,
                    url: statement_url,
                    facility_id: facility.id,
                    ds_submission_id: submission_id
                })
                await statement.save()

                sync_count++;
                console.log(`statement generated: ${statement}`)
                                
            } else { console.log('No statement required yet for this facility')}        
            
        }

        console.log('statement loop job complete')
        
        const jobReport = {
            msg: 'Statement Job complete',
            facility_count: facilities.length,
            sync_count: sync_count,
            skipped: skipped,
            errors: errors
        }

        console.log(jobReport)

    } catch (err) {
        console.log({error: 'critical error running statement generation job'})
        console.log(err)
    }   
}

module.exports = router;
 