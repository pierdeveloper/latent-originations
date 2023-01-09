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
    let base64string = encoded[1]
    
    // Create a buffer from the string
    let bufferObj = Buffer.from(base64string, "base64");
    
    // Encode the Buffer as a utf8 string
    let decodedString = bufferObj.toString("utf8");
    
    const secret = decodedString.substring(1);
    console.log('auth secret is..')
    console.log(secret)

    if(secret.length > 200) {
        const error = getError("unauthorized")
        return res.status(error.error_status).json({ 
            error_type: error.error_type,
            error_code: error.error_code,
            error_message: error.error_message
        })  
    }

    try {
        const customer = await Customer.findOne({ secret: secret });
        if(!customer) {
            const error = getError("unauthorized")
            return res.status(error.error_status).json({ 
                error_type: error.error_type,
                error_code: error.error_code,
                error_message: error.error_message
            })  
        }
        req.client_id = customer.client_id
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