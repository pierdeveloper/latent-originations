// simple monthly loan payment function that takes in a pier offer and returns the monthly payment

const calculate_monthly_payment = (offer) => {
    const i = (offer.interest_rate / 10000 ) / 12; 
    const a = offer.amount / 100;
    const n = offer.term;
    console.log(i, a, n)
    
    if (i === 0) {
        const periodic_payment = a / n;
        const periodic_payment_in_cents = periodic_payment * 100;
        return periodic_payment_in_cents.toFixed(0);
    } else {
        const periodic_payment = a / (((1+i)**n)-1) * (i*(1+i)**n);
        const periodic_payment_in_cents = periodic_payment * 100;
        return periodic_payment_in_cents.toFixed(0);
    }
    
}

module.exports = calculate_monthly_payment;