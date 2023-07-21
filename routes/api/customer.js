const express = require('express');
const router = express.Router();
const Customer = require('../../models/Customer');
const config = require('config');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { customerValidationRules } = require('../../helpers/validator.js');
const { pier_admin_key } = require('../../config/default');

// @route     POST customer
// @desc      Create a Pier customer profile w/ api keys
// @access    PRIVATE
router.post('/', customerValidationRules(), async (req, res) => {
    
    // verify admin key
    const { admin_key } = req.body
    if(admin_key !== config.get("pier_admin_key")) {
        return res.status(401).send('Unauthorized')
    }
    // Validate input
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array()});
    }
    try {
        const { company_name,
            dba_name,
            email,
            consumer_non_zero_enabled,
        } = req.body

        let customer = await Customer.findOne({ email })

        if (customer) {
            return res.status(400).json({ errors: [ { msg: 'Account with this email already exists' }] });
        }

        // create api keys
        const client_id_uuid = uuidv4();
        const client_id = client_id_uuid.replace(/-/g, '');
        const secret_uuid = uuidv4();
        const sandbox_secret = 'test_' + secret_uuid.replace(/-/g, '');
        const production_enabled = false;
        var duplicate_ssn_whitelist = [];

        // add dummy SSNs for easier testing
        if(config.get('envo') === 'sandbox' || config.get('envo') === "default") {
            duplicate_ssn_whitelist = ['000000000', '111111111']
        }
        console.log(config.get('envo'));

        customer = new Customer({
            client_id,
            sandbox_secret,
            company_name,
            dba_name,
            email,
            production_enabled,
            consumer_non_zero_enabled,
            duplicate_ssn_whitelist
        })  
        
        await customer.save()

        res.json(customer)

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route     PATCH customer
// @desc      Update a customer's details by client id. Note: does not support production enablement!
// @access    PUBLIC

router.patch('/:id', async (req, res) => {
    try {
        // verify admin key
        const { admin_key } = req.body
        if(admin_key !== config.get("pier_admin_key")) {
            return res.status(401).send('Unauthorized')
        }

        // find the user
        let customer = await Customer.findOne({ client_id: req.params.id });
        if (!customer) {
            return res.status(404).json({ msg: 'Invalid client id' })
        }

        // update and return
        const { company_name,
            dba_name,
            email,
            consumer_non_zero_enabled,
            custom_loan_agreement,
            nls_group_name,
            duplicate_ssn_whitelist,
            repayment_ach_enabled,
            disbursement_ach_enabled,
            underwriting_enabled,
            statements_enabled,
            facility_autocreate,
            legacy_single_application_offer_supported,
            blacklisted_states } = req.body;

        const customerFields = {};
        if(company_name) customerFields.company_name = company_name;
        if(blacklisted_states) customerFields.blacklisted_states = blacklisted_states;
        if(dba_name) customerFields.dba_name = dba_name;
        if(email) customerFields.email = email;
        if(consumer_non_zero_enabled !== null && consumer_non_zero_enabled !== undefined) customerFields.consumer_non_zero_enabled = consumer_non_zero_enabled;
        if(custom_loan_agreement !== null && custom_loan_agreement !== undefined) customerFields.custom_loan_agreement = custom_loan_agreement;
        if(nls_group_name) customerFields.nls_group_name = nls_group_name;
        if(duplicate_ssn_whitelist) customerFields.duplicate_ssn_whitelist = duplicate_ssn_whitelist;
        if(repayment_ach_enabled !== null && repayment_ach_enabled !== undefined) customerFields.repayment_ach_enabled = repayment_ach_enabled;
        if(disbursement_ach_enabled !== null && disbursement_ach_enabled !== undefined) customerFields.disbursement_ach_enabled = disbursement_ach_enabled;
        if(underwriting_enabled !== null && underwriting_enabled !== undefined) customerFields.underwriting_enabled = underwriting_enabled;
        if(statements_enabled !== null && statements_enabled !== undefined) customerFields.statements_enabled = statements_enabled;
        if(legacy_single_application_offer_supported !== null && legacy_single_application_offer_supported !== undefined) customerFields.legacy_single_application_offer_supported = legacy_single_application_offer_supported;
        if(facility_autocreate !== null && facility_autocreate !== undefined) customerFields.facility_autocreate = facility_autocreate;

        console.log(customerFields)
    
        customer = await Customer.findOneAndUpdate(
            {client_id: req.params.id},
            { $set: customerFields },
            { new: true}    
        )

        return res.json(customer)

    } catch (err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Invalid client id' });
        }
        res.status(500).send("Server Error");
    }
});

// @route     PATCH customer/enable_production
// @desc      Enable a customer for production
// @access    PRIVATE

router.patch('/:id/enable_production', async (req, res) => {
    try {
        //confirm node env is prod (need to block this in other envs)
        if(process.env.NODE_ENV !== 'production') {
            return res.status(403).send("This endpoint is only allowed in production")
        }

        // find the customer by client ID
        let customer = await Customer.findOne({ client_id: req.params.id });
        if (!customer) {
            return res.status(404).json({ msg: 'Invalid client id' })
        }

        // verify admin key
        const { admin_key, sandbox_client_id, nls_group_name } = req.body
        if(admin_key !== config.get("pier_admin_key")) {
            return res.status(401).send('Unauthorized')
        }

        // check if customer already enabled for prod
        if(customer.production_enabled) {
            return res.status(400).json({ msg: 'Account already enabled for production'});
        }

        // create key
        const secret_uuid = uuidv4();
        const production_secret = 'prod_' + secret_uuid.replace(/-/g, '');

        // set production secret, enable flag and set client id to sandbox client id
        customer.client_id = sandbox_client_id;
        customer.production_secret = production_secret;
        customer.production_enabled = true;
        customer.sandbox_secret = null;
        customer.nls_group_name = nls_group_name;
        await customer.save()
    
        return res.send('Production enabled for client!')

    } catch (err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Invalid client id' });
        }
        res.status(500).send("Server Error");
    }
});

// @route     GET customer 
// @desc      Retrieve a customer by client-id
// @access    PUBLIC
router.get('/:id', async (req, res) => {
    try {
        // verify admin key
        const { admin_key } = req.body
        if(admin_key !== config.get("pier_admin_key")) {
            return res.status(401).send('Unauthorized')
        }
        // Get customer and return it
        const customer = await Customer.findOne({ client_id: req.params.id});
        if(!customer) {
            return res.status(404).json({ msg: 'Invalid client id' });
        }
        res.json(customer);
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Invalid client id' });
        }
        res.status(500).send('Server Error');
    }
});

// @route     GET customers
// @desc      List all customers
// @access    PRIVATE
router.get('/', async (req, res) => {
    // verify admin key
    const { admin_key } = req.body
    if(admin_key !== config.get("pier_admin_key")) {
        return res.status(403).send('Unauthorized')
    }
    try {
        const customers = await Customer.find();
        res.json(customers);
    } catch(err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
})

// @route    DELETE api/customers/:id
// @desc     Delete customer
// @access   PUBLIC

router.delete('/:id', async (req, res) => {
    try {
        // verify admin key
        const { admin_key } = req.body
        if(admin_key !== config.get("pier_admin_key")) {
            return res.status(401).send('Unauthorized')
        }

        const customer = await Customer.findOne({ client_id: req.params.id});

        if(!customer) {
            return res.status(404).json({ msg: 'Invalid client id' });
        }

        await customer.remove();
        res.json({ msg: "Customer removed" });
        
    } catch (err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Invalid client id' });
        }
        res.status(500).send('Server Error');
    }
});

module.exports = router;

