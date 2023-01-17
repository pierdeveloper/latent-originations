
// Errors dictionary
const errors = {
    internal_server_error: {
        error_code: "INTERNAL_SERVER_ERROR",
        error_message: "An unexpected error occurred",
        error_status: 500,
        error_type: "API_ERROR"
    }, 
    unsupported_product: {
        error_code: "PRODUCT_NOT_SUPPORTED",
        error_message: "This product is not supported for your api keys",
        error_status: 403,
        error_type: "API_ERROR"
    },
    duplicate_ein: {
        error_code: "DUPLICATE_EIN",
        error_message: "A borrower with that EIN already exists",
        error_status: 400,
        error_type: "BORROWER_ERROR"
    }, 
    duplicate_ssn: {
        error_code: "DUPLICATE_SSN",
        error_message: "A borrower with that SSN already exists",
        error_status: 400,
        error_type: "BORROWER_ERROR"
    }, 
    application_not_found: {
        error_code: "APPLICATION_NOT_FOUND",
        error_message: "The application resource does not exist",
        error_status: 404,
        error_type: "APPLICATION_ERROR"
    },
    application_cannot_be_approved: {
        error_code: "APPLICATION_CANNOT_BE_APPROVED",
        error_message: "The application's status must be PENDING in order to approve it",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    application_cannot_be_rejected: {
        error_code: "APPLICATION_CANNOT_BE_REJECTED",
        error_message: "The application's status must be PENDING in order to reject it",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    borrower_not_found: {
        error_code: "BORROWER_NOT_FOUND",
        error_message: "The borrower resource does not exist",
        error_status: 404,
        error_type: "BORROWER_ERROR"
    },
    invalid_borrower_id: {
        error_code: "INVALID_BORROWER_ID",
        error_message: "The borrower_id specified is invalid",
        error_status: 400,
        error_type: "BORROWER_ERROR"
    },
    invalid_application_id: {
        error_code: "INVALID_APPLICATION_ID",
        error_message: "The application_id specified is invalid",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    document_not_found: {
        error_code: "LOAN_AGREEMENT_NOT_FOUND",
        error_message: "The loan agreement resource does not exist",
        error_status: 404,
        error_type: "LOAN_AGREEMENT_ERROR"
    },
    invalid_document_id: {
        error_code: "INVALID_LOAN_AGREEMENT_ID",
        error_message: "The loan_agreement_id specified is invalid",
        error_status: 400,
        error_type: "LOAN_AGREEMENT_ERROR"
    },
    document_cannot_be_created: {
        error_code: "LOAN_AGREEMENT_CANNOT_BE_CREATED",
        error_message: "Can only create loan agreements for APPROVED applications",
        error_status: 400,
        error_type: "LOAN_AGREEMENT_ERROR"
    },
    document_cannot_be_signed: {
        error_code: "LOAN_AGREEMENT_CANNOT_BE_SIGNED",
        error_message: "The loan agreement's status must be PENDING_SIGNATURE in order to sign it",
        error_status: 400,
        error_type: "LOAN_AGREEMENT_ERROR"
    },
    document_creation_failed: {
        error_code: "LOAN_AGREEMENT_CREATION_FAILED",
        error_message: "The loan agremeent could not be created. Please retry",
        error_status: 400,
        error_type: "LOAN_AGREEMENT_ERROR"
    },
    state_not_supported: {
        error_code: "STATE_NOT_SUPPORTED",
        error_message: "The applicant's state or territory is not supported",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    unsupported_offer_terms: {
        error_code: "UNSUPPORTED_OFFER_TERMS",
        error_message: "The requested offer terms are not supported for this state",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    unauthorized: {
        error_code: "UNAUTHORIZED",
        error_message: "The API key is invalid. Make sure your API key is prefixed with a colon",
        error_status: 401,
        error_type: "INVALID_REQUEST_ERROR"
    },
    facility_already_exists: {
        error_code: "FACILITY_ALREADY_EXISTS",
        error_message: "A facility already exists for this loan agreement",
        error_status: 400,
        error_type: "FACILITY_ERROR"
    },
    facility_cannot_be_created: {
        error_code: "FACILITY_CANNOT_BE_CREATED",
        error_message: "The loan agreement must have a status of signed in order to create a facility for it",
        error_status: 400,
        error_type: "FACILITY_ERROR"
    },
    facility_not_found: {
        error_code: "FACILITY_NOT_FOUND",
        error_message: "The facility resoure does not exist",
        error_status: 404,
        error_type: "FACILITY_ERROR"
    },
    invalid_facility_id: {
        error_code: "INVALID_FACILITY_ID",
        error_message: "The facility_id specified is invalid",
        error_status: 400,
        error_type: "FACILITY_ERROR"
    },
    facility_cannot_be_closed: {
        error_code: "FACILITY_CANNOT_BE_CLOSED",
        error_message: "The facility is already closed",
        error_status: 400,
        error_type: "FACILITY_ERROR"
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