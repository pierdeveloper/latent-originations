const consumer_state_limits = require('../coverage/consumer.json');


const moher = (offer, state) => {

    // get state limits
    const state_limits = consumer_state_limits[state]
    console.log(state_limits)
    // set limits
    const limit_1 = state_limits.limit_1
    const limit_2 = state_limits.limit_2

    // check type 1
    if(
        offer.amount >= limit_1.amount.min && 
        offer.amount <= limit_1.amount.max &&
        offer.origination_fee <= limit_1.max_origination_fee &&
        offer.apr <= limit_1.max_apr ) 
        {
            return true
        }
    else if(
        offer.amount >= limit_2?.amount.min && 
        offer.amount <= limit_2?.amount.max &&
        offer.apr <= limit_2?.max_apr &&
        offer.origination_fee <= limit_2?.max_origination_fee ) 
        {
            return true
        }
    else {
        return false
    }

}

module.exports = { moher };