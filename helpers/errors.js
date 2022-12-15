
// Errors dictionary
const errors = {
    internal_server_error: {
        error_code: "internal_server_serror",
        error_message: "An unexpected error occurred",
        error_status: 500,
        error_type: "api_error"
    }, 
    duplicate_ein: {
        error_code: "duplicate_ein",
        error_message: "A borrower with that EIN already exists",
        error_status: 404,
        error_type: "borrower_error"
    }, 
    duplicate_ssn: {
        error_code: "duplicate_ssn",
        error_message: "A borrower with that SSN already exists",
        error_status: 404,
        error_type: "borrower_error"
    }, 
    borrower_not_found: {
        error_code: "borrower_not_found",
        error_message: "The borrower resource does not exist",
        error_status: 404,
        error_type: "borrower_error"
    },
    invalid_borrower_id: {
        error_code: "invalid_borrower_id",
        error_message: "The borrower_id specified is invalid",
        error_status: 404,
        error_type: "borrower_error"
    }
}

const getError = (error_code) => {
    console.log(errors[error_code])
    return errors[error_code]
}
// construct and send the error response
function sendError(error_code) {
    const error = errors[error_code]
    return res.status(error.error_status).json({
        error_type: error.error_type,
        error_code: error.error_code,
        error_message: error.error_message
    })
}
 

  module.exports = {
    getError
  }