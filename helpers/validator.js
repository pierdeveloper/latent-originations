const { check, validationResult } = require('express-validator');
const config = require('config');

// Business borrower validation rules
const businessValidationRules = () => {
    return [
        check('address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(config.commercial_state_limits),
        check('beneficial_owners.*.address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('beneficial_owners.*.address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('beneficial_owners.*.address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(config.commercial_state_limits),
        check('beneficial_owners.*.date_of_birth', 'Date of Birth format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('beneficial_owners.*.email', 'Email must be a valid email')
            .isEmail(),
        check('beneficial_owners.*.phone', 'Phone must be a 10-digit US number')
            .isNumeric().isLength({min:10, max:10}),
        check('beneficial_owners.*.percent_ownership', 'Percent ownership of each beneficial owner must be a number between 0 and 10000 basis points')
            .isNumeric().isLength({min:0, max:10000}),
        check('beneficial_owners.*.ssn', 'SSN must be 9-digits')
            .isLength({min:9, max:9}).isNumeric(),
        check('business_contact.email', 'Email must be a valid email')
            .isEmail(),
        check('business_contact.phone', 'Phone must be a 10-digit US number')
            .isNumeric().isLength({min:10, max:10}),
        check('business_name', 'Business name max length is 256 chars')
            .isLength({max:256}),
        check('business_type','Business type must be one of CORPORATION, LLC, PARTNERSHIP, SOLE_PROPRIETORSHIP')
            .isIn(['CORPORATION', 'LLC', 'PARTNERSHIP', 'SOLE_PROPRIETORSHIP']),
        check('dba_name', 'DBA name max length is 256 chars')
            .isLength({max:256}),
        check('ein', 'EIN must be 9 digits')
            .isLength({min:9, max:9}).isNumeric(),
        check('incorporation_date', 'Incorporation date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('kyc_completion_date', 'KYC completion date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('phone', 'Phone must be a 10-digit US number')
            .isNumeric().isLength({min:10, max:10}),
        check('state_of_incorporation', "State must be valid 2-digit US state abbreviation")
            .isIn(config.commercial_state_limits)
    ]
  }

  // Business borrower validation rules
const consumerValidationRules = () => {
    return [
        check('address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(config.consumer_state_limits),
        check('date_of_birth', 'Date of Birth format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('email', 'Email must be a valid email')
            .isEmail(),
        check('ssn', 'SSN must be 9-digits')
            .isLength({min:9, max:9}).isNumeric(),
        check('kyc_completion_date', 'KYC completion date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true})
    ]
  }
  
  const applicationValidationRules = () => {
    return [
        check('credit_type', 'Credit type must be either LOAN, REVOLVING_LINE_OF_CREDIT or CLOSED_LINE_OF_CREDIT')
            .isIn(['LOAN', 'REVOLVING_LINE_OF_CREDIT', 'CLOSED_LINE_OF_CREDIT'])
    ]
  }

  const offerValidationRules = () => {
    return [
        check('offer.amount', 'Amount must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.annual_fee', 'Annual fee must be an integer greater than or equal to 0')
            .isInt({min:0}),   
        check('offer.apr', 'APR must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offer.billing_cycle', 'Billing cycle must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}), 
        check('offer.grace_period', 'Grace period must be an integer >= 0 and <= 1000')
            .isInt({min:0, max: 1000}),
        check('offer.grace_period_interest_rate', 'Grace period interest rate must be an integer >= 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.interest_free_period', 'Interest free period must be an integer between 0 and 365')
            .isInt({min:0, max:365}).optional({nullable: true}),
        check('offer.interest_rate', 'Interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offer.introductory_offer_interest_rate', 'Intro offer interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.introductory_offer_interest_rate_term', 'Intro offer interest rate term must be an integer >= 0 and <= 36')
            .isInt({min:0, max:36}).optional({nullable: true}),
        check('offer.late_payment_fee', "late payment fee must be an integer between 0 and 50000")
            .isInt({min:0, max:50000}),
        check('offer.origination_fee', 'Origination fee must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offer.repayment_frequency', 'Repayment frequency must be one of: WEEKLY, BIWEEKLY, MONTHLY')
            .isIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional({nullable: true}),
        check('offer.term', 'Term must be an integer >= 6 and <= 120')
            .isInt({min:6, max:120}),
    ]
  }

  const rejectionValidationRules = () => {
    return [
        check('rejection_reason', 'Rejection reason is not a valid reason')
            .isIn(config.rejection_reasons)
    ]
  }

  const customerValidationRules = () => {
    return [
        check('email', 'Must be valid email')
            .isEmail()
    ]
  }

  module.exports = {
    businessValidationRules,
    consumerValidationRules,
    customerValidationRules,
    applicationValidationRules,
    offerValidationRules,
    rejectionValidationRules
  }