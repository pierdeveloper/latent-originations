const crypto = require('crypto');

const algorithm = "aes-256-cbc"; 

const encrypt = (text) => {
    // generate 16 bytes of random data
    const iv = Buffer.from(process.env.AES_IV, 'hex');
    
    // secret key generate 32 bytes of random data
    const key = Buffer.from(process.env.AES_SECRET_KEY, 'hex');

    // the cipher function
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    // encrypt the message
    // input encoding
    // output encoding
    let encryptedData = cipher.update(text, "utf-8", "hex");
    
    encryptedData += cipher.final("hex");

    return encryptedData;
}

const decrypt = (encryptedText) => {
  // Initialize the secret key and IV
  const iv = Buffer.from(process.env.AES_IV, 'hex');
  const key = Buffer.from(process.env.AES_SECRET_KEY, 'hex');


  // Initialize the cipher object with the key and IV
  const decipher = crypto.createDecipheriv(algorithm, key, iv);

  // input encoding
  //decipher.setAutoPadding(false);

  // Initialize the encrypted text
  const encrypted = encryptedText;

  // Decrypt the text
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;

}


module.exports = {
    encrypt,
    decrypt
}