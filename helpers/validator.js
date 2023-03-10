const { check, validationResult } = require('express-validator');
const states = require('../helpers/coverage/states.json');
const rejection_reasons = require('../helpers/rejectionReasons.json');

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
            .isIn(states.states),
        check('beneficial_owners.*.address.line_1', 'Address line 1 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.line_2', 'Address line 2 max length is 256 chars')
            .isLength({max:256}),
        check('beneficial_owners.*.address.city', 'City max length is 30 chars')
            .isLength({max:30}),
        check('beneficial_owners.*.address.zip', 'Zip code must be 5 digits')
            .isNumeric().isLength({min:5, max:5}),
        check('beneficial_owners.*.address.state', "State must be valid 2-digit US state abbreviation")
            .isIn(states.states),
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
        check('business_type','Business type must be one of corporation, llc, partnership, sole_proprietorship')
            .isIn(['corporation', 'llc', 'partnership', 'sole_proprietorship']),
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
            .isIn(states.states)
    ]
  }

  // Consumer create validation rules
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
            .isIn(states.states),
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

  const consumerUpdateValidationRules = () => {
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
            .isIn(states.states),
        check('date_of_birth', 'Date of Birth format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
        check('email', 'Email must be a valid email')
            .isEmail(),
        check('kyc_completion_date', 'KYC completion date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true})
    ]
  }
  
  const applicationValidationRules = () => {
    return [
        check('credit_type', 'Credit type is invalid')
            .isIn(['consumer_installment_loan', 'consumer_revolving_line_of_credit', 'consumer_closed_line_of_credit',
                'consumer_bnpl', 'commercial_installment_loan', 'commercial_revolving_line_of_credit', 'commercial_closed_line_of_credit',
                'commercial_bnpl' ])
    ]
  }

  const offerValidationRules = () => {
    return [
        check('offer.amount', 'Amount must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offer.annual_fee', 'Annual fee must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),   
        check('offer.apr', 'APR must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.billing_cycle', 'Billing cycle must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}), 
        check('offer.finance_charge', 'Finance charge must be an integer >= 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.grace_period', 'Grace period must be an integer >= 0 and <= 1000')
            .isInt({min:0, max: 1000}).optional({nullable: true}),
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
        check('offer.repayment_frequency', 'Repayment frequency must be one of: weekly, biweekly, monthly')
            .isIn(['weekly', 'biweekly', 'monthly']).optional({nullable: true}),
        check('offer.term', 'Term must be an integer >= 6 and <= 120')
            .isInt({min:6, max:120}).optional({nullable: true}),
    ]
  }

  const rejectionValidationRules = () => {
    return [
        check('rejection_reasons', 'rejection reasons must be a list of 1-4 reasons')
            .isArray()
            .custom(values => values.length <= 4),
        check('rejection_reasons.*', 'Invalid rejection reason')
            .isIn(rejection_reasons)
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
    consumerUpdateValidationRules,
    customerValidationRules,
    applicationValidationRules,
    offerValidationRules,
    rejectionValidationRules
  }