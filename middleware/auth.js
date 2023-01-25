const config = require('config');
const basicAuth = require('express-basic-auth')
const Customer = require('../models/Customer');
const { getError } = require('../helpers/errors.js');

module.exports = async function(req, res, next) {

    const auth = req.headers.authorization
    if(!auth) {
        const error = getError("unauthorized")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })  
    }
    const encoded = auth.split(" ");

    // The base64 encoded input string
    let base64string = encoded[1];
    
    // Create a buffer from the string
    let bufferObj = Buffer.from(base64string, "base64");
    
    // Encode the Buffer as a utf8 string
    let decodedString = bufferObj.toString("utf8");
    console.log(decodedString)
    const decodedSubStrings = decodedString.split(':');
    const client_id = decodedSubStrings[0];
    const secret = decodedSubStrings[1];


    if(secret.length > 200 || client_id.length > 200) {
        const error = getError("unauthorized")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })  
    }

    try {
        // for production
        if(process.env.NODE_ENV === 'production') {

            // look up customer
            const customer = await Customer.findOne({ production_secret: secret });

            // confirm customer prod key is valid and customer is enabled for prod
            if(!customer || customer.client_id !== client_id || customer.production_enabled === false) {
                const error = getError("unauthorized")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })  
            }

            // set client id and continue
            req.client_id = customer.client_id;
        } else {
        // for dev/staging/sandbox
            // look up customer
            const customer = await Customer.findOne({ sandbox_secret: secret });

            if(!customer || customer.client_id !== client_id) {
                const error = getError("unauthorized")
                return res.status(error.error_status).json({ 
                    error_type: error.error_type,
                    error_code: error.error_code,
                    error_message: error.error_message
                })  
            }
            // set client id and continue
            req.client_id = customer.client_id
        }

        next();

    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            const error = getError("unauthorized")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })  
        }
        res.status(500).send('Server Error');
    }
}