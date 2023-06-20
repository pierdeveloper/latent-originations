const { getError } = require('../../helpers/errors.js')
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const { encrypt, decrypt } = require('../../helpers/crypto');
const auth = require('../../middleware/auth');
const router = express.Router();
const Business = require('../../models/Business');
const Borrower = require('../../models/Borrower');
const Consumer = require('../../models/Consumer');
const { validationResult } = require('express-validator');
const { businessValidationRules, consumerValidationRules, consumerUpdateValidationRules } = require('../../helpers/validator.js');
const {createNLSConsumer} = require('../../helpers/nls.js');
const responseFilters = require('../../helpers/responseFilters.json');
const config = require('config');
const Customer = require('../../models/Customer.js');


// @route     POST user
// @desc      Create a business user
// @access    Public
router.post('/business', [auth, businessValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)
    
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "BORROWER_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    try {
        const client_id = req.client_id

        const { address, beneficial_owners,
            business_contact,
            business_name, 
            business_type, 
            dba_name, 
            ein, 
            incorporation_date, 
            kyc_completion_date,
            phone,
            state_of_incorporation } = req.body

        let business = await Business.findOne({ ein, client_id })

        if (business) {
            const error = getError("duplicate_ein")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // create borrower
        const borrower_id = 'bor_' + uuidv4().replace(/-/g, '');
        let borrower = new Borrower({
            id: borrower_id,
            type: "business",
            client_id: client_id
        });

        await borrower.save();

        const cif_number = Math.floor(Math.random() * 900000000000000) + 100000000000000;
        beneficial_owners[0].cif_number = cif_number;

        // create business and set the borrower_id on it
        business = new Business({
            address,
            beneficial_owners,
            id: borrower_id,
            business_contact,
            business_name,
            business_type,
            client_id,
            dba_name,
            ein,
            incorporation_date,
            kyc_completion_date,
            phone,
            state_of_incorporation
        });

        let nlsSuccess = await createNLSConsumer(beneficial_owners[0]); // todo fix this temporary hack!
        
        await business.save();

        business = await Business.findOne({ id: borrower_id, client_id })
            .select('-_id -__v -client_id');

        console.log(business);            
        res.json(business);

    } catch (err) {
        console.log(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});


// @route     PATCH business borrower
// @desc      Update a business user
// @access    Public
router.patch('/business/:id', [auth, businessValidationRules()], async (req, res) => {
    //TODO - check for EIN uniqueness on update call
    console.log(req.headers)
    console.log(req.body)
    try {
        //lookup borrower
        let borrower = await Borrower.findOne({ id: req.params.id })
        if(!borrower || borrower.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // find the business 
        let business = await Business.findOne({ id: req.params.id });
        if (!business || business.client_id !== req.client_id) {
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        // validations
        const errors = validationResult(req);
        if(!errors.isEmpty()) {
            const response = {
                error_type: "BORROWER_ERROR",
                error_code: "INVALID_INPUT",
                error_message: "A value provided in the body is incorrect. See error_detail for more",
                error_detail: errors.array()
            }
            return res.status(400).json(response);
        }
        // update and return
        const { address, beneficial_owners,
            business_contact,
            business_name, 
            business_type, 
            dba_name, 
            incorporation_date, 
            kyc_completion_date,
            phone,
            state_of_incorporation } = req.body
        
        if(address) business.address = address;
        if(beneficial_owners) business.beneficial_owners = beneficial_owners;
        if(business_contact) business.business_contact = business_contact;
        if(business_name) business.business_name = business_name;
        if(business_type) business.business_type = business_type;
        if(dba_name) business.dba_name = dba_name;
        if(incorporation_date) business.incorporation_date = incorporation_date;
        if(kyc_completion_date) business.kyc_completion_date = kyc_completion_date;
        if(phone) business.phone = phone;
        if(state_of_incorporation) business.state_of_incorporation = state_of_incorporation;

        await business.save()

        business = await Business.findOne({ id: req.params.id })
            .select('-_id -__v -client_id');
        
        console.log(business); 
        res.json(business);

    } catch (err) {
        console.log(err)
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_borrower_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});


// @route     POST user
// @desc      Create a consumer user
// @access    Public
router.post('/consumer', [auth, consumerValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const response = {
            error_type: "BORROWER_ERROR",
            error_code: "INVALID_INPUT",
            error_message: "A value provided in the body is incorrect. See error_detail for more",
            error_detail: errors.array()
        }
        return res.status(400).json(response);
    }

    try {
        const client_id = req.client_id

        const { address, date_of_birth,
            email,
            first_name,
            last_name,
            kyc_completion_date,
            phone,
            ssn } = req.body

        const customer = await Customer.findOne({ client_id });

        // confirm the address is not blacklisted for this customer
        const blacklisted_states = customer.blacklisted_states;
        if(blacklisted_states.includes(address.state)) {
            const error = getError("unsupported_state")
            return res.status(error.error_status).json({
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        } 

        // encrypt ssn
        const encrypted_ssn = encrypt(ssn);


        // create borrower
        const borrower_id = 'bor_' + uuidv4().replace(/-/g, '');
        const cif_number = Math.floor(Math.random() * 900000000000000) + 100000000000000;

        let borrower = new Borrower({
            id: borrower_id,
            type: "consumer",
            client_id: client_id
        });

        // create consumer 
        
        consumer = new Consumer({
            address,
            id: borrower_id,
            cif_number,
            date_of_birth,
            email,
            first_name,
            last_name,
            client_id,
            kyc_completion_date,
            phone,
            ssn: encrypted_ssn
        });

        // add consumer to NLS (quick hack to reduce latency is to do this asynch and hope it works)
        let nlsSuccess = /*await*/ createNLSConsumer(consumer);
        /*
        if(!nlsSuccess) {
            console.log('error creating NLS user');
            throw new Error("TODO")
        } */

        // Add borrower and consumer data to mongo
        await borrower.save();
        await consumer.save();

        consumer = await Consumer.findOne({ id: borrower_id, client_id })
            .select(responseFilters['consumer'] + ' -client_id');

        console.log(consumer); 
        res.json(consumer);

    } catch (err) {
        console.log(err);
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});


// @route     PATCH consumer borrower
// @desc      Update a consumer borrower
// @access    Public
router.patch('/consumer/:id', [auth, consumerUpdateValidationRules()], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)
    //TODO - check for SSN uniqueness on update call
    try {
        //lookup borrower
        console.log('client id is..')
        console.log(req.client_id)
        let borrower = await Borrower.findOne({ id: req.params.id })
        if(!borrower || borrower.client_id !== req.client_id) {
            console.log('the dude aint found');
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }


        // find the consumer 
        let consumer = await Consumer.findOne({ id: req.params.id });
        if (!consumer || consumer.client_id !== req.client_id) {
            console.log('consumer not found');
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        // validations
        const errors = validationResult(req);
        if(!errors.isEmpty()) {
            const response = {
                error_type: "invalid_input",
                error_code: 400,
                error_message: "A value provided in the body is incorrect. See error_detail for more",
                error_detail: errors.array()
            }
            return res.status(400).json(response);
        }
        // update and return
        const { address,
            date_of_birth,
            email,
            first_name,
            last_name,
            kyc_completion_date,
            phone } = req.body
        
        if(address) consumer.address = address;
        if(date_of_birth) consumer.date_of_birth = date_of_birth;
        if(email) consumer.email = email;
        if(first_name) consumer.first_name = first_name;
        if(last_name) consumer.last_name = last_name;
        if(kyc_completion_date) consumer.kyc_completion_date = kyc_completion_date;
        if(phone) consumer.phone = phone;

        await consumer.save()

        consumer = await Consumer.findOne({ id: req.params.id })
        .select(responseFilters['consumer'] + ' -client_id');

        console.log(consumer); 
        return res.json(consumer)

    } catch (err) {
        console.log(err)
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_borrower_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
});


// @route     GET borrower by id
// @desc      Retrieve a business or consumer's borrower's details
// @access    Public
router.get('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    console.log('retreving borrwoer');
    try {
        //lookup borrower
        let borrower = await Borrower.findOne({ id: req.params.id })
        console.log(borrower)
        if(!borrower || borrower.client_id !== req.client_id) {
            console.log('borrower not found');
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        if (borrower.type === 'consumer') {
            var consumer = await Consumer.findOne({ id: req.params.id })
                .select(responseFilters['consumer']);
            if(!consumer || consumer.client_id !== req.client_id) {
                const error = getError("borrower_not_found")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
            consumer.client_id = undefined;

            console.log(consumer); 
            res.json(consumer);

        } else { // it's a business borrower
            const business = await Business.findOne({ id: req.params.id })
                .select('-_id -__v');
            if(!business || business.client_id !== req.client_id) {
                const error = getError("borrower_not_found")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            }
            business.client_id = undefined;

            console.log(business); 
            res.json(business);
        }

        
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("invalid_borrower_id")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     GET borrowers
// @desc      List all borrowers
// @access    Public
router.get('/', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {

        const consumers = await Consumer.find({ client_id: req.client_id })
            .select(responseFilters['consumer'] + ' -client_id');

        const businesses = await Business.find({ client_id: req.client_id })
            .select('-_id -__v -client_id');

        const borrowers = consumers.concat(businesses);

        console.log(borrowers); 
        res.json(borrowers);
    } catch(err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

// @route     DELETE a borrowers (sandbox only!)
// @desc      List all borrowers
// @access    Public
router.delete('/:id', [auth], async (req, res) => {
    console.log(req.headers)
    console.log(req.body)

    try {
        // require sandbox/dev (error on prod/staging)
        if(!config.get('allow_sandbox_testing_endpoints')) {
            console.log('error! borrower deletion not allowed in prod/staging')
            const error = getError("endpoint_not_allowed_in_production")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            }) 
        }

        // pull up the borrower resource 
        let borrower = await Borrower.findOne({ id: req.params.id })
        console.log(borrower)
        if(!borrower || borrower.client_id !== req.client_id) {
            console.log('borrower not found');
            const error = getError("borrower_not_found")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })
        }

        var borrower_detail = {}
        if(borrower.type === 'consumer') {
            borrower_detail = await Consumer.findOne({ id: req.params.id })
        } else {
            borrower_detail = await Business.findOne({ id: req.params.id })
        }
        
        // delete the details resource
        await borrower_detail.deleteOne({id: req.params.id}, (err) => {
            if (err) {
                console.log('error deleting borrower');
                const error = getError("unable_to_delete_borrower")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } else {
              console.log('Object deleted successfully!');
            }
          });

        // delete the borrower resource
        await borrower.deleteOne({id: req.params.id}, (err) => {
            if (err) {
                console.log('error deleting borrower');
                const error = getError("unable_to_delete_borrower")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })
            } else {
              console.log('Object deleted successfully!');
            }
          });

        res.json({ msg: "This borrower has been deleted"});
    } catch(err) {
        const error = getError("internal_server_error")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })
    }
})

module.exports = router;