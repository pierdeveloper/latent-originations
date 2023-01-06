const express = require('express');
const router = express.Router();
const Customer = require('../../models/Customer');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { customerValidationRules } = require('../../helpers/validator.js');

// @route     POST customer
// @desc      Create a Pier customer profile w/ api keys
// @access    PRIVATE
router.post('/', customerValidationRules(), async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array()});
    }
    try {
        const { company_name,
            dba_name,
            email
        } = req.body

        let customer = await Customer.findOne({ email })

        if (customer) {
            return res.status(400).json({ errors: [ { msg: 'Account with this email already exists' }] });
        }

        // create api keys
        const client_id_uuid = uuidv4();
        const client_id = 'test_' + client_id_uuid.replace(/-/g, '');
        const secret_uuid = uuidv4();
        const secret = 'test_' + secret_uuid.replace(/-/g, '');

        customer = new Customer({
            client_id,
            secret,
            company_name,
            dba_name,
            email
        })
        
        await customer.save()

        res.json(customer)

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route     PATCH customer
// @desc      Update a customer by client id
// @access    PUBLIC

router.patch('/:id', async (req, res) => {
    try {
        // find the user
        let customer = await Customer.findOne({ client_id: req.params.id });
        if (!customer) {
            return res.status(404).json({ msg: 'Invalid client id' })
        }

        // update and return
        const { company_name,
            dba_name,
            email } = req.body

        const customerFields = {};
        if(company_name) customerFields.company_name = company_name;
        if(dba_name) customerFields.dba_name = dba_name;
        if(email) customerFields.email = email;
    
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

// @route     GET customer 
// @desc      Retrieve a customer by client-id
// @access    PUBLIC
router.get('/:id', async (req, res) => {
    try {
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
router.get('/admin/:adminKey', async (req, res) => {
    if(req.params.adminKey !== 'pier-admin-key-1000') {
        res.status(401).send('Access Denied')
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

