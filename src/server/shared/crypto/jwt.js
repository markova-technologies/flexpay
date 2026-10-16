const jwt = require('jsonwebtoken');
const { loadConfig } = require('../../config');

function signAccessToken(payload) {
  const config = loadConfig();
  return jwt.sign(payload, config.JWT_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: config.JWT_ACCESS_EXPIRY,
  });
}

function verifyAccessToken(token) {
  const config = loadConfig();
  return jwt.verify(token, config.JWT_PUBLIC_KEY, {
    algorithms: ['RS256'],
  });
}

module.exports = { signAccessToken, verifyAccessToken };
