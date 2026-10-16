class AuthPolicy {
  static canLogin(user) {
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }
    if (user.status === 'SUSPENDED') {
      return { allowed: false, reason: 'Account suspended' };
    }
    return { allowed: true };
  }
}

module.exports = { AuthPolicy };
