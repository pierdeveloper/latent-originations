const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CreditTypes = Object.freeze({
    CONSUMER_INSTALLMENT_LOAN: 'consumer_installment_loan',
    CONSUMER_REVOLVING_LINE_OF_CREDIT: 'consumer_revolving_line_of_credit',
    CONSUMER_BNPL: 'consumer_bnpl',
    COMMERCIAL_NET_TERMS: 'commercial_net_terms',
    COMMERCIAL_INSTALLMENT_LOAN: 'commercial_installment_loan',
    COMMERCIAL_REVOLVING_LINE_OF_CREDIT: 'commercial_revolving_line_of_credit',
    COMMERCIAL_MERCHANT_ADVANCE: 'commercial_merchant_advance'
});

const PaymentPeriods = Object.freeze({
    WEEKLY: 'weekly',
    BIWEEKLY: 'biweekly',
    SEMI_MONTHLY: 'semi_monthly',
    SEMI_MONTHLY_14: 'semi_monthly_14',
    SEMI_MONTHLY_FIRST_15TH: 'semi_monthly_first_15th',
    SEMI_MONTHLY_LAST_15TH: 'semi_monthly_last_15th',
    MONTHLY: 'monthly'
});

const ApplicationStatuses = Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    INCOMPLETE: 'incomplete',
    REJECTED: 'rejected'
});

// Base Offer Schema
const OfferSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    }
    
    // Any common properties can go here
}, { discriminatorKey: 'type' });

// Loan Term Schema
const LoanTermSchema = new mongoose.Schema({
    term: {
        type: Number,
        required: true
    },
    term_type: {
        type: String,
        enum: ['days', 'months', 'payments'],
        required: true
    },
    term_due: {
        type: Number,
        required: false
    }
}, { _id: false })

const LoanOfferSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    apr: {
        type: Number,
        required: false
    },
    grace_period: {
        term: {
            type: Number,
            required: false,
            default: 0
        },
        interest_rate: {
            type: Number,
            required: false,
            default: 0
        }
    },
    interest_rate: {
        type: Number,
        required: false,
        default: 0
    },
    late_payment_fee: {
        type: Number,
        required: false,
        default: 0
    },
    origination_fee: {
        type: Schema.Types.Mixed,
        required: false,
        default: 0
    },
    first_payment_date: {
        type: String,
        required: false
    },
    payment_period: {
        type: String,
        enum: Object.values(PaymentPeriods),
        required: true,
        default: PaymentPeriods.MONTHLY
    },
    periodic_payment: {
        type: Number,
        required: false
    },
    loan_term: {
        type: LoanTermSchema,
        required: true
    }
}, { _id: false }); 

const LineOfCreditOfferSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    apr: {
        type: Number,
        required: false
    },
    interest_rate: {
        type: Number,
        required: true
    },
    annual_fee: {
        type: Number,
        required: false
    },
    billing_cycle: {
        type: Number,
        required: false
    },
    finance_charge: {
        type: Number,
        required: false
    },
    grace_period: {
        term: {
            type: Number,
            required: false,
            default: 0
        },
        interest_rate: {
            type: Number,
            required: false,
            default: 0
        }
    },
    late_payment_fee: {
        type: Number,
        required: false
    },
    origination_fee: {
        type: Schema.Types.Mixed,
        required: true
    }
}, { _id: false });

const MerchantAdvanceOfferSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    due_date: {
        type: String,
        required: true
    },
    repayment_fee: {
        type: Number,
        required: true
    }
})

const ApplicationSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    borrower_id: {
        type: String,
        required: true
    },
    client_id: {
        type: String,
        required: false
    },
    created_on: {
        type: Date,
        default: Date.now
    },
    decisioned_on: {
        type: Date,
        required: false
    },
    credit_type: {
        type: String,
        enum: Object.values(CreditTypes),
        required: true
    },
    offers: {
        type: [OfferSchema],
        required: false 
    },
    // deprecated
    offer: {
        id: {
            type: String,
            required: false
        },
        type: {
            type: String,
            enum: ['loan', 'revolving_line_of_credit'],
            required: false
        },
        amount: {
            type: Number,
            required: false
        },
        apr: {
            type: Number,
            required: false
        },
        annual_fee: {
            type: Number,
            required: false
        },
        billing_cycle: {
            type: Number,
            required: false
        },
        finance_charge: {
            type: Number,
            required: false
        },
        grace_period: {
            type: Number,
            required: false
        },
        grace_period_interest_rate: {
            type: Number,
            required: false
        },
        interest_free_period: {
            type: Number,
            required: false
        },
        interest_rate: {
            type: Number,
            required: false
        },
        introductory_offer_interest_rate: {
            type: Number,
            required: false
        },
        introductory_offer_interest_rate_term: {
            type: Number,
            required: false
        },
        late_payment_fee: {
            type: Number,
            required: false
        },
        origination_fee: {
            type: Schema.Types.Mixed,
            required: false
        },
        first_payment_date: {
            type: String,
            required: false
        },
        repayment_frequency: { // deprecated
            type: String,
            required: false
        },
        payment_period: {
            type: String,
            required: false
        },
        periodic_payment: {
            type: Number,
            required: false
        },
        term: {
            type: Number,
            required: false
        },
        third_party_disbursement_destination: {
            type: String,
            required: false
        }
    },
    rejection_reasons: {
        type: Array,
        required: false
    },
    requested_amount: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: Object.values(ApplicationStatuses),
        required: false,
        default: "pending"
    },
    third_party_disbursement_destination: {
        type: String,
        required: false
    }, 
    lender_of_record: {
        type: String,
        required: false,
        default: 'pier'
    },
    credit_data: {
        fico: {
            type: Number,
            required: false
        },
        has_bankruptcy_history: {
            type: Boolean,
            required: false
        }
    }

});


const Offer = mongoose.model('offer', OfferSchema);
const LoanOffer = Offer.discriminator('loan_offer', LoanOfferSchema);
const LineOfCreditOffer = Offer.discriminator('revolving_line_of_credit_offer', LineOfCreditOfferSchema);
const MerchantAdvanceOffer = Offer.discriminator('merchant_advance_offer', MerchantAdvanceOfferSchema);


const OriginationFeeSchema = new mongoose.Schema({
    fee: {
        type: Number,
        required: false
    },
    fee_type: {
        type: String,
        enum: ['flat', 'percentage'],
        required: false
    },
})



const Application = mongoose.model('application', ApplicationSchema);

// Add discriminators
//Application.discriminator('LoanOffer', LoanOfferSchema);
//Application.discriminator('LineOfCreditOffer', LineOfCreditOfferSchema);

module.exports = {Application, Offer, LoanOffer, LineOfCreditOffer, MerchantAdvanceOffer};
//module.exports = Application = mongoose.model('application', ApplicationSchema)