
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
        error_status: 400,
        error_type: "borrower_error"
    }, 
    duplicate_ssn: {
        error_code: "duplicate_ssn",
        error_message: "A borrower with that SSN already exists",
        error_status: 400,
        error_type: "borrower_error"
    }, 
    application_not_found: {
        error_code: "application_not_found",
        error_message: "The application resource does not exist",
        error_status: 404,
        error_type: "application_error"
    },
    application_cannot_be_approved: {
        error_code: "application_cannot_be_approved",
        error_message: "The application's status must be pending in order to approve it",
        error_status: 400,
        error_type: "application_error"
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
        error_status: 400,
        error_type: "borrower_error"
    },
    invalid_application_id: {
        error_code: "invalid_application_id",
        error_message: "The application_id specified is invalid",
        error_status: 400,
        error_type: "application_error"
    },
    document_not_found: {
        error_code: "document_not_found",
        error_message: "The document resource does not exist",
        error_status: 404,
        error_type: "document_error"
    },
    invalid_document_id: {
        error_code: "invalid_document_id",
        error_message: "The document_id specified is invalid",
        error_status: 400,
        error_type: "document_error"
    },
    document_cannot_be_created: {
        error_code: "document_cannot_be_created",
        error_message: "The application must have a status of pending to create a document for it",
        error_status: 400,
        error_type: "document_error"
    },
    document_cannot_be_signed: {
        error_code: "document_cannot_be_signed",
        error_message: "The document's status must be pending in order to sign it",
        error_status: 400,
        error_type: "document_error"
    },
    document_creation_failed: {
        error_code: "document_creation_failed",
        error_message: "The document could not be created. Please retry",
        error_status: 400,
        error_type: "document_error"
    },
    state_not_supported: {
        error_code: "state_not_supported",
        error_message: "The applicant's state or territory is not supported",
        error_status: 400,
        error_type: "application_error"
    },
    unsupported_offer_terms: {
        error_code: "unsupported_offer_terms",
        error_message: "The requested offer terms are not supported for this state",
        error_status: 400,
        error_type: "application_error"
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