
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
    non_zero_interest_not_enabled: {
        error_code: "NON_ZERO_INTEREST_NOT_ENABLED",
        error_message: "Your account is not permitted to create loans with interest. Contact Pier to enable your account for loans with interest",
        error_status: 403,
        error_type: "API_ERROR"
    },
    endpoint_not_allowed_in_production: {
        error_code: "ENDPOINT_NOT_ALLOWED_IN_PRODUCTION",
        error_message: "This endpoint is only allowed in the sandbox",
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
    unable_to_delete_borrower: {
        error_code: "UNABLE_TO_DELETE_BORROWER",
        error_message: "There was an error attempting to delete the borrower",
        error_status: 400,
        error_type: "BORROWER_ERROR"
    },
    unsupported_state: {
        error_code: "UNSUPPORTED_STATE",
        error_message: "This state is not supported for your API keys. Contact Pier to enable",
        error_status: 400,
        error_type: "BORROWER_ERROR"
    },
    application_not_found: {
        error_code: "APPLICATION_NOT_FOUND",
        error_message: "The application resource does not exist",
        error_status: 404,
        error_type: "APPLICATION_ERROR"
    },
    application_cannot_be_created: {
        error_code: "APPLICATION_CANNOT_BE_CREATED",
        error_message: "The application credit type can't be created for this type of borrower",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    application_cannot_be_approved: {
        error_code: "APPLICATION_CANNOT_BE_APPROVED",
        error_message: "The application's status must be pending in order to approve it",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    application_cannot_be_rejected: {
        error_code: "APPLICATION_CANNOT_BE_REJECTED",
        error_message: "The application's status must be pending in order to reject it",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    application_cannot_be_evaluated: {
        error_code: "APPLICATION_CANNOT_BE_EVALUATED",
        error_message: "The application's status must be pending in order to evaluate it",
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
    invalid_statement_id: {
        error_code: "INVALID_STATEMENT_ID",
        error_message: "The statement_id specified is invalid",
        error_status: 400,
        error_type: "STATEMENT_ERROR"
    },
    statement_not_found: {
        error_code: "STATEMENT_NOT_FOUND",
        error_message: "The statement resource does not exist",
        error_status: 404,
        error_type: "STATEMENT_ERROR"
    },
    third_party_missing: {
        error_code: "THIRD_PARTY_MISSING",
        error_message: "For BNPL loans, a third_party_disbursement_destination field must be provided with name of the third party",
        error_status: 400,
        error_type: "APPLICATION_ERROR"
    },
    document_not_found: {
        error_code: "LOAN_AGREEMENT_NOT_FOUND",
        error_message: "The loan agreement resource does not exist",
        error_status: 404,
        error_type: "LOAN_AGREEMENT_ERROR"
    },
    document_already_exists: {
        error_code: "LOAN_AGREEMENT_ALREADY_EXISTS",
        error_message: "A pending loan agreement for this application already exists",
        error_status: 400,
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
        error_message: "Can only create loan agreements for approved applications",
        error_status: 400,
        error_type: "LOAN_AGREEMENT_ERROR"
    },
    document_cannot_be_signed: {
        error_code: "LOAN_AGREEMENT_CANNOT_BE_SIGNED",
        error_message: "The loan agreement's status must be pending_signature in order to sign it",
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
        error_message: "The API key is invalid. Make sure you are passing your client id and secret via an authorization header",
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
    },
    missing_repayment_bank_details: {
        error_code: "MISSING_REPAYMENT_BANK_DETAILS",
        error_message: "Invalid or missing repayment bank account & routing info. Add repayment bank details before submitting a payment",
        error_status: 400,
        error_type: "PAYMENT_ERROR"
    },
    repayment_ach_disabled: {
        error_code: "REPAYMENT_ACH_DISABLED",
        error_message: "Your account is not enabled for ACH payments",
        error_status: 400,
        error_type: "PAYMENT_ERROR"
    },
    payment_not_found: {
        error_code: "PAYMENT_NOT_FOUND",
        error_message: "The payment resource does not exist",
        error_status: 404,
        error_type: "PAYMENT_ERROR"
    },
    invalid_payment_id: {
        error_code: "INVALID_PAYMENT_ID",
        error_message: "The payment_id specified is invalid",
        error_status: 400,
        error_type: "PAYMENT_ERROR"
    },
    credit_policy_not_found: {
        error_code: "CREDIT_POLICY_NOT_FOUND",
        error_message: "The credit policy resource does not exist",
        error_status: 404,
        error_type: "CREDIT_POLICY_ERROR"
    },
    credit_policy_not_in_drafted_state: {
        error_code: "CREDIT_POLICY_NOT_IN_DRAFTED_STATE",
        error_message: "The credit policy must be in a drafted state in order to submit it for approval",
        error_status: 400,
        error_type: "CREDIT_POLICY_ERROR"
    },
    credit_policy_not_in_approved_state: {
        error_code: "CREDIT_POLICY_NOT_IN_APPROVED_STATE",
        error_message: "The credit policy must be in an approved state in order to deploy it",
        error_status: 400,
        error_type: "CREDIT_POLICY_ERROR"
    },
    credit_policy_changes_not_allowed: {
        error_code: "CREDIT_POLICY_CHANGES_NOT_ALLOWED",
        error_message: "The credit policy may not be changed in its current state. Create a new one to make changes",
        error_status: 400,
        error_type: "CREDIT_POLICY_ERROR"
    },
    credit_policy_no_rules: {
        error_code: "CREDIT_POLICY_NO_RULES",
        error_message: "Cannot deploy or submit a policy with no rules",
        error_status: 400,
        error_type: "CREDIT_POLICY_ERROR"
    },
    credit_policy_offer_limits_incomplete: {
        error_code: "CREDIT_POLICY_OFFER_LIMITS_INCOMPLETE",
        error_message: "The credit policy's offer limits are incomplete. Please make sure all offer limits are specified",
        error_status: 400,
        error_type: "CREDIT_POLICY_ERROR"
    },
    invalid_credit_policy_id: {
        error_code: "INVALID_CREDIT_POLICY_ID",
        error_message: "The credit_policy_id specified is invalid",
        error_status: 400,
        error_type: "CREDIT_POLICY_ERROR"
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