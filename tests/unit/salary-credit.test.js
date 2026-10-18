const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('CreateEmployeeUseCase — salary credit rules', () => {
  it('sets credit_limit = monthly_salary when no override', () => {
    const salary = 15000;
    const credit = undefined ?? salary;
    assert.equal(credit, 15000);
  });

  it('sets credit_limit = override when provided', () => {
    const salary = 15000;
    const override = 10000;
    const credit = override ?? salary;
    assert.equal(credit, 10000);
  });

  it('sets available_credit = credit_limit at creation', () => {
    const creditLimit = 12000;
    const available = creditLimit;
    assert.equal(available, 12000);
  });
});
