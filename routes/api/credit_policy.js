const express = require('express');
const auth = require('../../middleware/auth');
const config = require('config');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getError } = require('../../helpers/errors.js');
const { validationResult } = require('express-validator');
const { creditPolicyRuleValidationRules } = require('../../helpers/validator.js');
const responseFilters = require('../../helpers/responseFilters.json');
const {CreditPolicy, Rule, OfferLimit} = require('../../models/CreditPolicy');
const { findOne } = require('../../models/Customer');



// @route     POST credit_policy
// @desc      Create a credit policy
// @access    Public
router.post('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // body validation
    /*
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "FACILITY_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }*/

    try {
        const client_id = req.client_id;
        // create credit policy
        const cpid = "cp_" + uuidv4().replace(/-/g, '');
        const credit_policy = new CreditPolicy({
            id: cpid,
            client_id: client_id
        })

        // save credit policy
        await credit_policy.save();

        // return the credit policy
        let credit_policyResponse = await CreditPolicy.findOne({ id: credit_policy.id, client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');

        console.log(credit_policyResponse)
        res.json(credit_policyResponse);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})


// @route     POST submit_for_approval
// @desc      Submit a credit policy for approval
// @access    Public
router.post('/:id/submit_for_approval', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // body validation
    /*
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "FACILITY_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }*/

    try {
        const client_id = req.client_id;
        // pull up credit policy
        let credit_policy = await CreditPolicy.findOne({ id: req.params.id, client_id: client_id });

        // check if credit policy exists
        if(!credit_policy) {
            const error = getError("credit_policy_not_found")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm credit policy is in 'drafted' state
        if(credit_policy.status !== 'drafted') {
            const error = getError("credit_policy_not_in_drafted_state")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm length of rules array is greater than 0)
        if(credit_policy.rules.length === 0) {
            const error = getError("credit_policy_no_rules") 
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }


        // set credit policy status to pending_approval
        credit_policy.status = 'pending_approval';

        // if env is sandbox or dev, auto set status to approved
        if(process.env.NODE_ENV === 'sandbox' || process.env.NODE_ENV === 'development') {
            credit_policy.status = 'approved';
        }
        await credit_policy.save();

        // return the credit policy
        let credit_policyResponse = await CreditPolicy.findOne({ id: credit_policy.id, client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');
        res.json(credit_policyResponse);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     POST /deploy
// @desc      Deploy a credit policy for decisioning 
// @access    Public
router.post('/:id/deploy', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    // body validation
    /*
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "FACILITY_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }*/

    try {
        const client_id = req.client_id;
        // pull up credit policy
        let credit_policy = await CreditPolicy.findOne({ id: req.params.id, client_id: client_id });

        // check if credit policy exists
        if(!credit_policy) {
            const error = getError("credit_policy_not_found")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm credit policy is in 'approved' state
        if(credit_policy.status !== 'approved') {
            const error = getError("credit_policy_not_in_approved_state")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm length of rules array is greater than 0
        if(credit_policy.rules.length === 0) {
            const error = getError("credit_policy_no_rules") 
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }


        // pull up existing deployed credit policy; if it exists, set status to approved
        let existingDeployedPolicy = await CreditPolicy.findOne({ client_id: client_id, status: 'deployed' });
        if(existingDeployedPolicy) {
            existingDeployedPolicy.status = 'approved';
            await existingDeployedPolicy.save();
        }

        // set credit policy status to pending_approval
        credit_policy.status = 'deployed';
        await credit_policy.save();

        // return the credit policy
        let credit_policyResponse = await CreditPolicy.findOne({ id: credit_policy.id, client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');
        res.json(credit_policyResponse);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET policy by id
// @desc      Retrieve a policy's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const policy = await CreditPolicy.findOne({ id: req.params.id });
        if(!policy || policy.client_id !== req.client_id) {
            const error = getError("credit_policy_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // Response
        let policyResponse = await CreditPolicy.findOne({ id: policy.id, client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');
        res.json(policyResponse);

    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_credit_policy_id")
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

// @route     GET credit policies
// @desc      List all credit policies
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const policies = await CreditPolicy.find({ client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');

        console.log(policies); 
        res.json(policies);

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

// @route     POST /id/rules
// @desc      Add a rule to a credit policy
// @access    Public
router.post('/:id/rules', [auth, creditPolicyRuleValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "APPLICATION_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    try {
        const client_id = req.client_id;
        const {
            property,
            operator,
            value
        } = req.body;

        // pull up credit policy
        //let credit_policy = await CreditPolicy.findOne({ id: req.params.id, client_id: client_id });
        var credit_policy = await CreditPolicy.findOne({ id: req.params.id });

        // check if credit policy exists
        if(!credit_policy || credit_policy.client_id !== client_id) {
            const error = getError("credit_policy_not_found")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm credit policy is in 'drafted' state (otherwise can't make changes)
        if(credit_policy.status !== 'drafted') {
            const error = getError("credit_policy_changes_not_allowed")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        console.log(credit_policy)

        // create the rule obj
        let rule = new Rule({
            property: property,
            operator: operator,
            value: value
        });

        console.log(rule);

        // update the credit policy with ruleset an
        credit_policy.rules.push(rule);
        credit_policy.last_updated = Date.now();
        await credit_policy.save();

        console.log(credit_policy);
        
        // return the credit policy
        let credit_policyResponse = await CreditPolicy.findOne({ id: credit_policy.id, client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');
        res.json(credit_policyResponse);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     POST /id/offer_limits
// @desc      Add offer limits to a credit policy
// @access    Public
/*
router.post('/:id/offer_limits', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const client_id = req.client_id;
        const {
            max_amount,
            max_term,
            min_interest_rate
        } = req.body;

        // pull up credit policy
        //let credit_policy = await CreditPolicy.findOne({ id: req.params.id, client_id: client_id });
        var credit_policy = await CreditPolicy.findOne({ id: req.params.id });

        // check if credit policy exists
        if(!credit_policy || credit_policy.client_id !== client_id) {
            const error = getError("credit_policy_not_found")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm credit policy is in 'drafted' state (otherwise can't make changes)
        if(credit_policy.status !== 'drafted') {
            const error = getError("credit_policy_changes_not_allowed")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        console.log(credit_policy)

        // create the rule obj
        let offerLimits = new OfferLimit({
            max_amount,
            max_term,
            min_interest_rate
        });

        console.log(offerLimits);

        // update the credit policy with ruleset an
        credit_policy.offer_limits = offerLimits;
        credit_policy.last_updated = Date.now();
        await credit_policy.save();

        console.log(credit_policy);
        
        // return the credit policy
        let credit_policyResponse = await CreditPolicy.findOne({ id: credit_policy.id, client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');
        res.json(credit_policyResponse);

    } catch (err) {
        console.error(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})


*/


// SCRATCH BELOW!

// @route     POST /id/rulesets
// @desc      Add a ruleset to a credit policy
// @access    Public
router.post('/:id/rulesets', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        const client_id = req.client_id;
        // pull up credit policy
        //let credit_policy = await CreditPolicy.findOne({ id: req.params.id, client_id: client_id });
        var credit_policy = await CreditPolicy.findOne({ id: req.params.id });

        // check if credit policy exists
        if(!credit_policy || credit_policy.client_id !== client_id) {
            const error = getError("credit_policy_not_found")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // confirm credit policy is in 'drafted' state (otherwise can't make changes)
        if(credit_policy.status !== 'drafted') {
            const error = getError("credit_policy_changes_not_allowed")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        console.log(credit_policy)

        // create the ruleset obj
        let rulesetId = "rs_" + uuidv4().replace(/-/g, '');
        let ruleset = new Ruleset({
            id: rulesetId,
            credit_policy_id: credit_policy.id
        });

        console.log(ruleset);

        // update the credit policy with ruleset an
        credit_policy.rulesets.push(ruleset);
        credit_policy.last_updated = Date.now();
        await credit_policy.save();

        console.log(credit_policy);

        // return the credit policy
        let credit_policyResponse = await CreditPolicy.findOne({ id: credit_policy.id, client_id: req.client_id })
            .select(responseFilters['credit_policy'] + ' -client_id');
        res.json(credit_policyResponse);

    } catch (err) {
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