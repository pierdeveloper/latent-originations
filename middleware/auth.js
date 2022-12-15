const config = require('config');
const basicAuth = require('express-basic-auth')
const Customer = require('../models/Customer');

module.exports = async function(req, res, next) {

    const auth = req.headers.authorization
    if(!auth) {
        return res.status(401).json({ msg: 'Authorization failed. Supply an auth header' });
    }
    const encoded = auth.split(" ");

    // The base64 encoded input string
    let base64string = encoded[1]
    
    // Create a buffer from the string
    let bufferObj = Buffer.from(base64string, "base64");
    
    // Encode the Buffer as a utf8 string
    let decodedString = bufferObj.toString("utf8");
    
    const secret = decodedString.substring(1);

    if(secret.length > 200) {
        return res.status(401).json({ msg: 'Authorization failed' });
    }

    try {
        const customer = await Customer.findOne({ secret: secret });
        if(!customer) {
            return res.status(401).json({ msg: 'Authorization failed' });
        }
        req.client_id = customer.client_id
        next();
    } catch(err) {
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(401).json({ msg: 'Authorization failed' });
        }
        res.status(500).send('Server Error');
    }
}