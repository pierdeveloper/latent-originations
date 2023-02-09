const crypto = require('crypto');

const algorithm = "aes-256-cbc"; 
const password = 'word12)(p';


const encrypt = (text) => {
    // generate 16 bytes of random data
    const initVector = crypto.randomBytes(16);
    
    // secret key generate 32 bytes of random data
    const Securitykey = crypto.randomBytes(32);
    
    // the cipher function
    const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
    
    // encrypt the message
    // input encoding
    // output encoding
    let encryptedData = cipher.update(text, "utf-8", "hex");
    
    encryptedData += cipher.final("hex");
    
    console.log("Encrypted message: " + encryptedData);
    return encryptedData;
}

const decrypt = (text) => {
  const decipher = crypto.createDecipher(algorithm, password);
  let dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}


module.exports = {
    encrypt,
    decrypt
}