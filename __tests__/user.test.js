
const {calculate_periodic_payment} = require('../helpers/docspring.js');

describe('ds helper functions', () => {
    test ('interest calculation is done correctly', () => {
        const periodic_payment = calculate_periodic_payment(
            10000,
            24,
            12,
            0.145
        );

        expect(periodic_payment).toEqual("482.49")
    })
})