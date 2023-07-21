const { check, oneOf, validationResult } = require('express-validator');
const states = require('../helpers/coverage/states.json');
const rejection_reasons = require('../helpers/rejectionReasons.json');
const routingNumberValidator = require('bank-routing-number-validator');
const moment = require('moment');

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
                'commercial_bnpl', 'commercial_merchant_advance' /*todo: remove this*/ ])
    ]
  }

  const offerValidationRules = () => {
    return [
        check('offer.amount', 'Amount must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offer.annual_fee', 'Annual fee must be an integer greater than or equal to 0')
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
            .isInt({min:0}).optional({nullable: true}),
        check('offer.introductory_offer_interest_rate', 'Intro offer interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.introductory_offer_interest_rate_term', 'Intro offer interest rate term must be an integer >= 0 and <= 36')
            .isInt({min:0, max:36}).optional({nullable: true}),
        check('offer.late_payment_fee', "late payment fee must be an integer between 0 and 50000")
            .isInt({min:0, max:50000}).optional({nullable: true}),
        check('offer.origination_fee', 'Origination fee must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.repayment_frequency', 'Repayment frequency must be one of: biweekly, semi_monthly, monthly')
            .isIn(['weekly', 'biweekly', 'semi_monthly_first_15th', 'semi_monthly_last_15th', 'semi_monthly', 'semi_monthly_14', 'monthly']).optional({nullable: true}),
        check('offer.term', 'Term must be an integer >= 3 and <= 260')
            .isInt({min:3, max:260}),
        check('offer.term').custom((value, { req }) => {
            if(req.body.offer.repayment_frequency === 'monthly' && value < 3) {
                throw new Error('Term must be at least 3 for monthly payment period');
            } else if(req.body.offer.repayment_frequency === 'semi_monthly' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(req.body.offer.repayment_frequency === 'semi_monthly_14' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(req.body.offer.repayment_frequency === 'semi_monthly_first_15' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(req.body.offer.repayment_frequency === 'semi_monthly_last_15' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(req.body.offer.repayment_frequency === 'biweekly' && value < 7) {
                throw new Error('Term must be at least 7 for biweekly payment period');
            } else if(req.body.offer.repayment_frequency === 'weekly' && value < 13) {
                throw new Error('Term must be at least 13 for weekly monthly payment period');
            }
            return true;
            }),
        check('offer.first_payment_date', 'First payment date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}).optional({nullable: true})
            .custom((value) => {
                const inputDate = moment(value, 'YYYY-MM-DD');
                const today = moment();
                if (!inputDate.isAfter(today)) {
                  throw new Error('First payment date invalid');
                }
                // validate that first payment date is not more than 45 days in the future
                if (inputDate.diff(today, 'days') > 45) {
                    throw new Error('First payment date cannot be more than 45 days in the future');
                }
                return true;
              })
            .if((value, { req }) => req.body.offer.repayment_frequency === "semi_monthly_first_15th")
                .custom((value) => {
                    const inputDate = moment(value, 'YYYY-MM-DD');
                    // verify that date is the 1st or 15th
                    if (inputDate.date() !== 1 && inputDate.date() !== 15) {
                        throw new Error('First payment date must be the 1st or 15th of the month for this repayment frequency');
                    }
                    return true;
                }),
        check('offer.first_payment_date', 'First payment date format must conform to yyyy-mm-dd')
            .if((value, { req }) => req.body.offer.repayment_frequency === "semi_monthly_last_15th")
                .custom((value) => {
                    console.log('validating first date field for this repay freq type!')
                    const inputDate = moment(value, 'YYYY-MM-DD');
                    // verify that date is the last day or 15th
                    if (inputDate.date() !== 15 && inputDate.date() !== inputDate.daysInMonth()) {
                        throw new Error('First payment date must be the last day or 15th of the month for this repayment frequency');
                    }
                    return true;
                })

    ]
  }

  const loanOffersListValidationRules = () => {
    return [
        check('offers', 'Offers must be an array')
            .isArray(),
        check('offers.*.amount', 'Amount must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offers.*.type', 'Type must be one of: loan_offer')
            .isIn(['loan_offer']),
        check('offers.*.grace_period.term', 'Grace period must be an integer >= 0 and <= 1000')
            .isInt({min:0, max: 1000}).optional({nullable: true}),
        check('offers.*.grace_period.interest_rate', 'Grace period interest rate must be an integer >= 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offers.*.interest_rate', 'Interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offers.*.late_payment_fee', "late payment fee must be an integer between 0 and 50000")
            .isInt({min:0, max:50000}).optional({nullable: true}),
        check('offers.*.origination_fee', 'Origination fee must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offers.*.payment_period', 'Repayment frequency must be one of: biweekly, semi_monthly, monthly')
            .isIn(['weekly', 'biweekly', 'semi_monthly_first_15th', 'semi_monthly_last_15th', 'semi_monthly', 'semi_monthly_14', 'monthly']).optional({nullable: true}),
        check('offers.*.loan_term.term_type', 'Term type must be one of: months, days, payments')
            .isIn(['months', 'days', 'payments']),
        check('offers.*.loan_term.term', 'Term must be an integer >= 3 and <= 260')
            .isInt({min:3, max:260}),
        check('offers.*.loan_term.term').custom((value, { req, path }) => {
            console.log(`value: ${value} path: ${path}`)
            const index = parseInt(path.split('[')[1].replace(']', ''), 10);
            console.log(`index: ${index}`)
            const payment_period = req.body.offers[index].payment_period;
            console.log(`payment_period: ${payment_period}`)
            if(payment_period === 'monthly' && value < 3) {
                throw new Error('Term must be at least 3 for monthly payment period');
            } else if(payment_period === 'semi_monthly' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(payment_period === 'semi_monthly_14' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(payment_period === 'semi_monthly_first_15' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(payment_period === 'semi_monthly_last_15' && value < 6) {
                throw new Error('Term must be at least 6 for semi monthly payment period');
            } else if(payment_period === 'biweekly' && value < 7) {
                throw new Error('Term must be at least 7 for biweekly payment period');
            } else if(payment_period === 'weekly' && value < 13) {
                throw new Error('Term must be at least 13 for weekly monthly payment period');
            }
            return true;
        }),
        check('offers.*.first_payment_date', 'First payment date format must conform to yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}).optional({nullable: true})
            .custom((value) => {
                const inputDate = moment(value, 'YYYY-MM-DD');
                const today = moment();
                if (!inputDate.isAfter(today)) {
                    throw new Error('First payment date invalid');
                }
                // validate that first payment date is not more than 45 days in the future
                if (inputDate.diff(today, 'days') > 45) {
                    throw new Error('First payment date cannot be more than 45 days in the future');
                }
                return true;
                })
            .if((value, { req }) => req.body.offer.payment_period === "semi_monthly_first_15th")
                .custom((value) => {
                    const inputDate = moment(value, 'YYYY-MM-DD');
                    // verify that date is the 1st or 15th
                    if (inputDate.date() !== 1 && inputDate.date() !== 15) {
                        throw new Error('First payment date must be the 1st or 15th of the month for this repayment frequency');
                    }
                    return true;
                }),
        check('offers.*.first_payment_date', 'First payment date format must conform to yyyy-mm-dd')
            .if((value, { req }) => req.body.offer.payment_period === "semi_monthly_last_15th")
                .custom((value) => {
                    console.log('validating first date field for this repay freq type!')
                    const inputDate = moment(value, 'YYYY-MM-DD');
                    // verify that date is the last day or 15th
                    if (inputDate.date() !== 15 && inputDate.date() !== inputDate.daysInMonth()) {
                        throw new Error('First payment date must be the last day or 15th of the month for this repayment frequency');
                    }
                    return true;
                })
            ]
  }

  const locOffersListValidationRules = () => {
    return [
        check('offers', 'Offers must be an array')
            .isArray(),
        check('offers.*.amount', 'Amount must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offers.*.annual_fee', 'Annual fee must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),   
        check('offers.*.billing_cycle', 'Billing cycle must be an integer greater than or equal to 0')
            .isInt({min:0}), 
        check('offers.*.finance_charge', 'Finance charge must be an integer >= 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offers.*.grace_period', 'Grace period must be an integer >= 0 and <= 1000')
            .isInt({min:0, max: 1000}),
        check('offers.*.grace_period_interest_rate', 'Grace period interest rate must be an integer >= 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offers.*.interest_free_period', 'Interest free period must be an integer between 0 and 365')
            .isInt({min:0, max:365}).optional({nullable: true}),
        check('offers.*.interest_rate', 'Interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offers.*.introductory_offer_interest_rate', 'Intro offer interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offers.*.introductory_offer_interest_rate_term', 'Intro offer interest rate term must be an integer >= 0 and <= 36')
            .isInt({min:0, max:36}).optional({nullable: true}),
        check('offers.*.late_payment_fee', "late payment fee must be an integer between 0 and 50000")
            .isInt({min:0, max:50000}).optional({nullable: true}),
        check('offers.*.origination_fee', 'Origination fee must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true})
    
    ]
}

  const locOfferValidationRules = () => {
    return [
        check('offer', 'Offer parameter must be provided')
            .isObject(),
        check('offer.amount', 'Amount must be an integer greater than or equal to 0')
            .isInt({min:0}),
        check('offer.annual_fee', 'Annual fee must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),   
        check('offer.billing_cycle', 'Billing cycle must be an integer greater than or equal to 0')
            .isInt({min:0}), 
        check('offer.finance_charge', 'Finance charge must be an integer >= 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.grace_period', 'Grace period must be an integer >= 0 and <= 1000')
            .isInt({min:0, max: 1000}),
        check('offer.grace_period_interest_rate', 'Grace period interest rate must be an integer >= 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.interest_free_period', 'Interest free period must be an integer between 0 and 365')
            .isInt({min:0, max:365}).optional({nullable: true}),
        check('offer.interest_rate', 'Interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.introductory_offer_interest_rate', 'Intro offer interest rate must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true}),
        check('offer.introductory_offer_interest_rate_term', 'Intro offer interest rate term must be an integer >= 0 and <= 36')
            .isInt({min:0, max:36}).optional({nullable: true}),
        check('offer.late_payment_fee', "late payment fee must be an integer between 0 and 50000")
            .isInt({min:0, max:50000}).optional({nullable: true}),
        check('offer.origination_fee', 'Origination fee must be an integer greater than or equal to 0')
            .isInt({min:0}).optional({nullable: true})
    
        ]
    }

  const loanOfferValidationRules = () => {
    return [
        //check offer exists
        check('offer', 'Offer parameter must be provided')
            .isObject(),
    check('offer.amount', 'Amount must be an integer greater than or equal to 0')
        .isInt({min:0}),
    check('offer.grace_period.term', 'Grace period must be an integer >= 0 and <= 1000')
        .isInt({min:0, max: 1000}).optional({nullable: true}),
    check('offer.grace_period.interest_rate', 'Grace period interest rate must be an integer >= 0')
        .isInt({min:0}).optional({nullable: true}),
    check('offer.interest_rate', 'Interest rate must be an integer greater than or equal to 0')
        .isInt({min:0}).optional({nullable: true}),
    check('offer.late_payment_fee', "late payment fee must be an integer between 0 and 50000")
        .isInt({min:0, max:50000}).optional({nullable: true}),
    check('offer.origination_fee', 'Origination fee must be an integer greater than or equal to 0')
        .isInt({min:0}).optional({nullable: true}),
    check('offer.payment_period', 'Repayment frequency must be one of: biweekly, semi_monthly, monthly')
        .isIn(['weekly', 'biweekly', 'semi_monthly_first_15th', 'semi_monthly_last_15th', 'semi_monthly', 'semi_monthly_14', 'monthly']).optional({nullable: true}),
    check('offer.loan_term', 'Term must be an integer >= 3 and <= 260')
        .isInt({min:3, max:260}),
    check('offer.loan_term').custom((value, { req }) => {
        if(req.body.offer.payment_period === 'monthly' && value < 3) {
            throw new Error('Term must be at least 3 for monthly payment period');
        } else if(req.body.offer.payment_period === 'semi_monthly' && value < 6) {
            throw new Error('Term must be at least 6 for semi monthly payment period');
        } else if(req.body.offer.payment_period === 'semi_monthly_14' && value < 6) {
            throw new Error('Term must be at least 6 for semi monthly payment period');
        } else if(req.body.offer.payment_period === 'semi_monthly_first_15' && value < 6) {
            throw new Error('Term must be at least 6 for semi monthly payment period');
        } else if(req.body.offer.payment_period === 'semi_monthly_last_15' && value < 6) {
            throw new Error('Term must be at least 6 for semi monthly payment period');
        } else if(req.body.offer.payment_period === 'biweekly' && value < 7) {
            throw new Error('Term must be at least 7 for biweekly payment period');
        } else if(req.body.offer.payment_period === 'weekly' && value < 13) {
            throw new Error('Term must be at least 13 for weekly monthly payment period');
        }
        return true;
        }),
    check('offer.first_payment_date', 'First payment date format must conform to yyyy-mm-dd')
        .isDate({format:"yyyy-mm-dd", strictMode:true}).optional({nullable: true})
        .custom((value) => {
            const inputDate = moment(value, 'YYYY-MM-DD');
            const today = moment();
            if (!inputDate.isAfter(today)) {
                throw new Error('First payment date invalid');
            }
            // validate that first payment date is not more than 45 days in the future
            if (inputDate.diff(today, 'days') > 45) {
                throw new Error('First payment date cannot be more than 45 days in the future');
            }
            return true;
            })
        .if((value, { req }) => req.body.offer.payment_period === "semi_monthly_first_15th")
            .custom((value) => {
                const inputDate = moment(value, 'YYYY-MM-DD');
                // verify that date is the 1st or 15th
                if (inputDate.date() !== 1 && inputDate.date() !== 15) {
                    throw new Error('First payment date must be the 1st or 15th of the month for this repayment frequency');
                }
                return true;
            }),
    check('offer.first_payment_date', 'First payment date format must conform to yyyy-mm-dd')
        .if((value, { req }) => req.body.offer.payment_period === "semi_monthly_last_15th")
            .custom((value) => {
                console.log('validating first date field for this repay freq type!')
                const inputDate = moment(value, 'YYYY-MM-DD');
                // verify that date is the last day or 15th
                if (inputDate.date() !== 15 && inputDate.date() !== inputDate.daysInMonth()) {
                    throw new Error('First payment date must be the last day or 15th of the month for this repayment frequency');
                }
                return true;
            })
    ]
  }

  const arrayOfOffersRules = check('offers.*').custom((object, { req, location, path }) => {
    if (object.type === 'loan_offer') {
      // if the object is of type one, apply typeOneRules
      return loanOfferRules.forEach(rule => rule.run(req));
    } else if (object.type === 'revolving_line_of_credit_offer') {
      // if the object is of type two, apply typeTwoRules
      return lineOfCreditRules.forEach(rule => rule.run(req));
    } else {
      throw new Error('Invalid object type');
    }
  });


  const rejectionValidationRules = () => {
    return [
        check('rejection_reasons', 'rejection reasons must be a list of 1-4 reasons')
            .isArray()
            .custom(values => values.length <= 4),
        check('rejection_reasons.*', 'Invalid rejection reason')
            .isIn(rejection_reasons)
    ]
  }

  const loanAgreementValidationRules = () => {
    return [
        check('application_id', 'application_id missing or invalid')
            .isString()
            .isLength({max: 100})
    ]
  }

  const paymentValidationRules = () => {
    return [
        check('amount', 'amount must be an integer (in cents).')
            .isInt(),
        check('date', 'date must be a string in the following format: YYYY-MM-DD')
            .isDate({format:"yyyy-mm-dd", strictMode:true}).optional({nullable: true}),
        check('facility_id', 'invalid facility id')
            .isString()
    ]
  }

  const disbursementValidationRules = () => {
    return [
        check('amount', 'amount must be an integer (in cents).')
            .isInt(),
        check('disbursement_bank_account.bank_routing_number', 'Bank account routing must be a valid routing number')
            .isLength({max: 100})
            .custom(value => {
                return routingNumberValidator.ABARoutingNumberIsValid(value)
            }),
        check('disbursement_bank_account.bank_account_number', 'Bank account number contains invalid characters')
            .isInt().isLength({max: 100}),
        check('disbursement_bank_account.type', 'Bank account type must be one of: checking, savings')
            .isIn(['checking', 'savings']),
    ]
  }

  const bankDetailsValidationRules = () => {
    return [
        check('bank_routing_number', 'Bank account routing must be a valid routing number')
            .isLength({max: 100})
            .custom(value => {
                return routingNumberValidator.ABARoutingNumberIsValid(value)
            }),
        check('bank_account_number', 'Bank account number contains invalid characters')
            .isInt().isLength({max: 100}),
        check('type', 'Bank account type must be one of: checking, savings')
            .isIn(['checking', 'savings'])
    ]
  }

  const autopayValidationRules = () => {
    return [
        check('bank_account.bank_routing_number', 'Bank account routing must be a valid routing number')
            .isLength({max: 100})
            .custom(value => {
                return routingNumberValidator.ABARoutingNumberIsValid(value)
            }),
        check('bank_account.bank_account_number', 'Bank account number contains invalid characters')
            .isInt().isLength({max: 100}),
        check('bank_account.type', 'Bank account type must be one of: checking, savings')
            .isIn(['checking', 'savings']),
        // check that additional_amount is a postive integer less than 10000000 and make it optional
        check('additional_amount', 'additional_amount must be a positive integer less than 10000000')
            .isInt({min: 0, max: 10000000}).optional({nullable: true})

    ]
}

  const customerValidationRules = () => {
    return [
        check('email', 'Must be valid email')
            .isEmail()
    ]
  }
  
  const advanceDateValidationRules = () => {
    return [
        check('date', 'Date must be formatted as yyyy-mm-dd')
            .isDate({format:"yyyy-mm-dd", strictMode:true}),
    ]
  }

  const creditPolicyRuleValidationRules = () => {
    return [
        check('property', 'The property specified is not supported')
            .isIn(['fico', 'has_bankruptcy_history']),
        check('operator', 'The operator field specified is not supported')
            .isIn(['greater_than', 'equal_to'])
    ]
}

const checkOfferValidationRules = () => {
    return [
        check('state', "State must be valid 2-digit US state abbreviation")
            .isIn(states.states),
        check('offers', "Offers list cannot be empty and must have at least one offer")
            .isArray()
            .custom(values => values.length > 0)
    ]
}

  module.exports = {
    arrayOfOffersRules,
    advanceDateValidationRules,
    businessValidationRules,
    checkOfferValidationRules,
    consumerValidationRules,
    consumerUpdateValidationRules,
    creditPolicyRuleValidationRules,
    customerValidationRules,
    applicationValidationRules,
    loanOfferValidationRules,
    locOfferValidationRules,
    loanOffersListValidationRules,
    locOffersListValidationRules,
    offerValidationRules,
    rejectionValidationRules,
    paymentValidationRules,
    disbursementValidationRules,
    autopayValidationRules,
    bankDetailsValidationRules,
    loanAgreementValidationRules
  }