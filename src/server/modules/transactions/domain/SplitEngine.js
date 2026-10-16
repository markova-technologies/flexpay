class SplitEngine {
  /**
   * Calculates how to split a purchase between FlexPay credit and M-PESA co-pay.
   * @param {number} totalAmount - ETB amount employee wants to spend
   * @param {number} availableCredit - ETB of credit employee currently has
   * @returns {{ creditPortion: number, copayPortion: number, requiresStkPush: boolean }}
   */
  static calculate(totalAmount, availableCredit) {
    const amount = Number(totalAmount);
    const credit = Number(availableCredit);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Transaction amount must be a positive number');
    }

    const safeCredit = Math.max(0, isNaN(credit) ? 0 : credit);
    const creditPortion = Math.min(amount, safeCredit);
    const copayPortion = Math.max(0, Number((amount - creditPortion).toFixed(2)));

    return {
      totalAmount: amount,
      creditPortion: Number(creditPortion.toFixed(2)),
      copayPortion: Number(copayPortion.toFixed(2)),
      requiresStkPush: copayPortion > 0,
    };
  }
}

module.exports = { SplitEngine };
