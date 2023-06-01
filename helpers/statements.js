
const { v4: uuidv4 } = require('uuid');
const Facility = require('../models/Facility');
const Statement = require('../models/Statement');
const Job = require('../models/Job');
const moment = require('moment');
const config = require('config');
const { getDocSpringSubmission, 
    createDocSpringSubmission, 
    generateDocspringStatementDataFields, 
    docspringTemplates } = require('./docspring.js');
const Consumer = require('../models/Consumer.js');
const { retrieveNLSLoan } = require('./nls.js');
const { WebClient } = require('@slack/web-api');
const pierFormats = require('./formats.js');


// utility function to generate a statement for a given facility. Responds w/ statement obj or an error
const generateStatement = async (facility) => {
    console.log(`attempting to generate statement for facility: ${facility.id}`)
    console.log(facility)

    // skip unsupported credit types
    switch (facility.credit_type) {
        case 'consumer_revolving_line_of_credit':
        case 'commercial_installment_loan':
        case 'commercial_revolving_line_of_credit':
        case 'commercial_bnpl':
            console.log('Statements for this credit type not supported for your api keys');
            return {status: "skipped", msg: 'Statements for this credit type not supported for your api keys'}
        default: break;
    }

    // check if billing date is today or in the past
    const next_statement_date = moment(facility.next_billing_date, pierFormats.shortDate);

    const today = moment(facility.interest_accrued_thru, pierFormats.shortDate); // technically this is the day before today's date; we do this instead of using moment() bc sandbox sometimes will test a future date, so actual date doesn't always work

    // need to generate statement when interest_accrued_thru date is one day before billing date ( since it lags 1 day); this is equivalent to moment() === billing date
    // if today is not the day before billing date, then we don't need to generate a statement
    if(!(today.isBefore(next_statement_date) && next_statement_date.diff(today, 'days') === 1)) {
        console.log('No statement required yet for this facility')
        return {status: "skipped", msg: 'No statement required yet for this facility'}
    }

    // Check that statement not already created for current billing cycle
    const existing_statement = await Statement.findOne(
        { facility_id: facility.id, statement_date: facility.next_billing_date }
    );
    if(existing_statement) {
        console.log('statement already exists for this facility')
        return { status: "skipped", msg: 'statement already exists for this facility'}
    }

    // check that client config has statements enabled
    let customer = await Customer.findOne({client_id: facility.client_id });
    // todo: check that customer has statements enabled

    // pull in borrower details
    const borrower_details = await Consumer.findOne({id: facility.borrower_id});
    if(!borrower_details) { return {status: "error", msg: 'error retrieving borrower details'} }
    console.log(`borrower details: ${borrower_details}`)

    // pull in nls loan details
    const nls_loan_details = await retrieveNLSLoan(facility.nls_account_ref);
    console.log(`nls loan details: ${nls_loan_details}`)
    if(nls_loan_details === 'nls_error') { return {status: "error", msg: 'error retrieving nls loan details'} }

    // Generate docspring data fields
    const statement_data_fields = generateDocspringStatementDataFields(facility, borrower_details, nls_loan_details)

    // Get template id
    const template_id = docspringTemplates.statements[facility.credit_type] 

    // Create DS submission
    const docspring_pending_submission = await createDocSpringSubmission(template_id, statement_data_fields)

    // If it's not created properly then error
    if(docspring_pending_submission.status !== "success") {
        console.log('error creating docspring statement submission')
        return {status: "error", msg: 'error creating docspring statement submission'}
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
    // todo error handle if no docspring submission retrieved/ error
    const statement_url = docspring_submission.permanent_download_url
    console.log(`statement url: ${statement_url}`)

    // If statement doesn't have a url then error
    if (statement_url === null) {
        console.log('error creating docspring statement submission')
        return {status: "error", msg: 'error creating docspring statement submission'}
    }

    // Create statement and save
    const statement_id = 'stmt_' + uuidv4().replace(/-/g, '');
    const statement_date = moment(next_statement_date).format(pierFormats.shortDate)

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
    return {status: "success", msg: 'statement generated', statement: statement}
}



// Statement generation job
const runStatementGenerateJob = async (facilities) => {
    const time_initiated = moment()
    var time_completed = moment()
    var status = 'failed'
    const errorsList = [];
    const skipped = [];
    var sync_count = 0;

    try {
        // loop thru each facility
        for (let i = 0; i < facilities.length; i++) {

            const facility = facilities[i];

            const job = await generateStatement(facility.id)

            // respond
            if(job.status === "success") {
                console.log(`statement generated`)
                console.log(job.statement)
                sync_count++;
            } else if(job.status === "skipped") {
                console.log('skipped')
                skipped.push({facility: facility.id, msg: job.msg})
            } else if (job.status === 'error') {
                console.log('error')
                errorsList.push({facility: facility.id, msg: job.msg})
            } else {
                console.log('unexpected error')
                errorsList.push({facility: facility.id, msg: job.msg})
            }
        }
        
        time_completed = moment();
        status = 'completed'
        console.log('statement loop job complete')
        

    } catch (err) {
        time_completed = moment();
        console.log({error: 'critical error running statement generation job'})
        console.log(err)
    }   

    // report the job
    const duration = moment.duration(time_completed.diff(time_initiated)).asSeconds()
    const jobReport = new Job({
        facility_count: facilities.length,
        sync_count: sync_count,
        skipped: skipped,
        errorsList: errorsList,
        time_initiated: time_initiated,
        time_completed: time_completed,
        type: 'statement',
        env: process.env.NODE_ENV,
        status: status,
        duration: duration
    })
    jobReport.save();
    console.log(jobReport);

    // ping slack for prod and sandbox facilities
    if(process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'sandbox') {
        console.log('running slack script')
        const slack = new WebClient(config.get('slack_bot_id'));
        (async () => {
            try {
                const greeting = '🔄 A cron job has finished running 🔄'
                const result = slack.chat.postMessage({
                    channel: '#crons',
                    text: greeting + '\n' + '\n' + `*Type:* Statement` +'\n' + `*Env:* ${process.env.NODE_ENV}` +'\n' + 
                        `*Status:* ${status}` + '\n' + `*Facility count:* ${facilities.length}` +'\n' + `*Sync count:* ${sync_count}`
                        + '\n' + `*Skipped:* ${skipped}` +'\n' + `*Errors:* ${errorsList}`
                        + '\n' + `*Time initiated:* ${time_initiated}` +'\n' + `*Time completed:* ${time_completed}`
                        + '\n' + `*Duration:* ${duration}`
                });
            }
            catch (error) { console.error(error); }
        })();
    }

}

module.exports = { generateStatement, runStatementGenerateJob }