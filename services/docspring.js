const axios = require('axios').default;
const config = require('config');

// Docspring auth token
const setHeader = () => {
    const username = config.get('docspringId');
    const pw = config.get('docspringSecret');
    const auth = 'Basic ' + Buffer.from(username + ':' + pw).toString('base64');
    const header = {'user-agent': 'node.js', 'Authorization': auth}
    return header;
}

// POST
// Create a Docspring submission with template and data fieldss
const createPDF = async (application, accepted_offer) => {

    // set headers and body params for post request
    const header = setHeader();
    const body_params = {
        data: {},
        test: config.get('docspringTest'),
        editable: false
    }

    try {

        const response = await axios.post(
            `https://api.docspring.com/api/v1/templates/tpl_XEEqGbEyFskM72rQkp/submissions`,
            JSON.stringify(body_params), 
            { headers: header }
        );

        return response.data;
      }

    catch (error) {
        console.log('CAUGHT DOCSPRING ERROR')
        // log errors
        console.log(error.response.data)
    }
}
    
// GET
// Get a Docspring pdf submission by id
  const getDocSpringSubmission = async (submission_id) => {
    const header = setHeader();
    const url = `https://api.docspring.com/api/v1/submissions/${submission_id}`;
    
    const response = await axios.get(
        url,
        { headers: header }
    );

    return response.data;

  }

  


module.exports = {
    createPDF,
    getDocSpringSubmission
}