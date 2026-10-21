const { AuthPolicy } = require('../../domain/AuthPolicy');
const { AuthRepository } = require('../outgoing/AuthRepository');
const { SessionRepository } = require('../outgoing/SessionRepository');
const { hashPassword, verifyPassword } = require('../../../../shared/crypto/argon2');
const { signAccessToken } = require('../../../../shared/crypto/jwt');
const { validateEmployeeId } = require('../../../../shared/crypto/employeeIdGenerator');
const { authenticate } = require('../../../../shared/middleware/authenticate');
const {
  orgRegisterSchema,
  orgLoginSchema,
  merchantRegisterSchema,
  merchantLoginSchema,
  employeeLoginSchema,
  forgotPasswordSchema,
} = require('../../../../shared/validation/schemas/auth.schemas');

async function authRoutes(fastify, options) {
  const authRepo = options.authRepo || new AuthRepository(options.db);
  const sessionRepo = options.sessionRepo || new SessionRepository(options.db);

  // Helper to set secure refresh token cookie
  function setRefreshTokenCookie(reply, rawToken) {
    if (!rawToken) return;
    const isProduction = process.env.NODE_ENV === 'production';
    reply.setCookie('refresh_token', rawToken, {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });
  }

  // Safe wrapper that attempts to create and set session refresh token without failing the HTTP request
  async function safeCreateRefreshToken(userId, req, rep) {
    try {
      const rawToken = await sessionRepo.createRefreshToken(userId, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      if (rawToken) {
        setRefreshTokenCookie(rep, rawToken);
      }
      return rawToken;
    } catch (err) {
      req.log.warn({ err: err.message }, 'Warning: Non-fatal error while creating refresh token session');
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // 1. Organization Registration
  // --------------------------------------------------------------------------
  fastify.post('/auth/org/register', async (request, reply) => {
    const parse = orgRegisterSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
    }

    const { orgName, tinNumber, contactPhone, mpesaShortcode, password } = parse.data;

    // Check duplicate TIN
    const existing = await authRepo.findOrgByTin(tinNumber);
    if (existing) {
      // Graceful auto-recovery for interrupted registrations with matching admin password
      const existingUser = await authRepo.findUserByOrgId(existing.id);
      if (existingUser) {
        const isMatch = await verifyPassword(existingUser.password_hash, password);
        if (isMatch) {
          const accessToken = signAccessToken({
            sub: existingUser.id,
            role: existingUser.role,
            orgId: existing.id,
          });

          await safeCreateRefreshToken(existingUser.id, request, reply);
          await authRepo.updateLastLogin(existingUser.id);

          return reply.code(200).send({
            message: 'Organization registered and verified successfully',
            organizationId: existing.id,
            userId: existingUser.id,
            accessToken,
            user: {
              id: existingUser.id,
              role: existingUser.role,
              orgId: existing.id,
              orgName: existing.name,
            },
          });
        }
      }
      return reply.code(409).send({ error: 'Organization with this TIN is already registered. Please sign in.' });
    }

    const passwordHash = await hashPassword(password);
    const org = await authRepo.createOrganization({
      name: orgName,
      tinNumber,
      contactPhone,
      mpesaShortcode,
    });

    try {
      await authRepo.createOrgCreditPolicy(org.id, 0);
    } catch (policyErr) {
      request.log.warn({ err: policyErr.message }, 'Non-fatal: failed to initialize default credit policy');
    }

    const user = await authRepo.createUser({
      role: 'ORG_ADMIN',
      organizationId: org.id,
      passwordHash,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      orgId: org.id,
    });

    await safeCreateRefreshToken(user.id, request, reply);
    await authRepo.updateLastLogin(user.id);

    return reply.code(201).send({
      message: 'Organization registered successfully',
      organizationId: org.id,
      userId: user.id,
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        orgId: org.id,
        orgName: org.name,
      },
    });
  });

  // --------------------------------------------------------------------------
  // 2. Organization Login
  // --------------------------------------------------------------------------
  fastify.post('/auth/org/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (request, reply) => {
    const parse = orgLoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid login payload', details: parse.error.issues });
    }

    const { tinNumber, password } = parse.data;
    const org = await authRepo.findOrgByTin(tinNumber);
    if (!org) {
      return reply.code(401).send({ error: 'Invalid TIN or credentials' });
    }

    const user = await authRepo.findUserByOrgId(org.id);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid TIN or credentials' });
    }

    const isMatch = await verifyPassword(user.password_hash, password);
    if (!isMatch) {
      return reply.code(401).send({ error: 'Invalid TIN or credentials' });
    }

    const policyCheck = AuthPolicy.canLogin(user);
    if (!policyCheck.allowed) {
      return reply.code(403).send({ error: policyCheck.reason });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      orgId: org.id,
    });

    await safeCreateRefreshToken(user.id, request, reply);
    await authRepo.updateLastLogin(user.id);

    return reply.send({
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        orgId: org.id,
        orgName: org.name,
      },
    });
  });

  // --------------------------------------------------------------------------
  // 3. Merchant Registration
  // --------------------------------------------------------------------------
  fastify.post('/auth/merchant/register', async (request, reply) => {
    const parse = merchantRegisterSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
    }

    const { businessName, mpesaNumber, category, contactPhone, password } = parse.data;

    const existing = await authRepo.findMerchantByMpesaNumber(mpesaNumber);
    if (existing) {
      const existingUser = await authRepo.findUserByMerchantId(existing.id);
      if (existingUser) {
        const isMatch = await verifyPassword(existingUser.password_hash, password);
        if (isMatch) {
          const accessToken = signAccessToken({
            sub: existingUser.id,
            role: existingUser.role,
            merchantId: existing.id,
          });

          await safeCreateRefreshToken(existingUser.id, request, reply);
          await authRepo.updateLastLogin(existingUser.id);

          return reply.code(200).send({
            message: 'Merchant registered and verified successfully',
            merchantId: existing.id,
            userId: existingUser.id,
            accessToken,
            user: {
              id: existingUser.id,
              role: existingUser.role,
              merchantId: existing.id,
              businessName: existing.business_name,
              category: existing.category,
              mpesaNumber: existing.mpesa_number,
            },
          });
        }
      }
      return reply.code(409).send({ error: 'Merchant with this M-PESA number is already registered. Please sign in.' });
    }

    const passwordHash = await hashPassword(password);
    const merchant = await authRepo.createMerchant({
      businessName,
      mpesaNumber,
      category,
      contactPhone,
    });

    const user = await authRepo.createUser({
      role: 'MERCHANT_OWNER',
      merchantId: merchant.id,
      passwordHash,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      merchantId: merchant.id,
    });

    await safeCreateRefreshToken(user.id, request, reply);
    await authRepo.updateLastLogin(user.id);

    return reply.code(201).send({
      message: 'Merchant registered successfully',
      merchantId: merchant.id,
      userId: user.id,
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        merchantId: merchant.id,
        businessName: merchant.business_name,
        category: merchant.category,
        mpesaNumber: merchant.mpesa_number,
      },
    });
  });

  // --------------------------------------------------------------------------
  // 4. Merchant Login
  // --------------------------------------------------------------------------
  fastify.post('/auth/merchant/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (request, reply) => {
    const parse = merchantLoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid login payload', details: parse.error.issues });
    }

    const { mpesaNumber, password } = parse.data;
    const merchant = await authRepo.findMerchantByMpesaNumber(mpesaNumber);
    if (!merchant) {
      return reply.code(401).send({ error: 'Invalid M-PESA number or credentials' });
    }

    if (merchant.status !== 'ACTIVE') {
      return reply.code(403).send({ error: 'Merchant account is pending verification or suspended. Contact support.' });
    }

    const user = await authRepo.findUserByMerchantId(merchant.id);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid M-PESA number or credentials' });
    }

    const isMatch = await verifyPassword(user.password_hash, password);
    if (!isMatch) {
      return reply.code(401).send({ error: 'Invalid M-PESA number or credentials' });
    }

    const policyCheck = AuthPolicy.canLogin(user);
    if (!policyCheck.allowed) {
      return reply.code(403).send({ error: policyCheck.reason });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      merchantId: merchant.id,
    });

    await safeCreateRefreshToken(user.id, request, reply);
    await authRepo.updateLastLogin(user.id);

    return reply.send({
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        merchantId: merchant.id,
        businessName: merchant.business_name,
        category: merchant.category,
        mpesaNumber: merchant.mpesa_number,
      },
    });
  });

  // --------------------------------------------------------------------------
  // 5. Employee Login (Credentials generated by Org Admin only)
  // --------------------------------------------------------------------------
  fastify.post('/auth/employee/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (request, reply) => {
    const parse = employeeLoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Invalid Employee ID or credentials format', details: parse.error.issues });
    }

    const { fpEmployeeId, password } = parse.data;
    const validation = validateEmployeeId(fpEmployeeId);
    if (!validation.valid) {
      return reply.code(400).send({ error: 'Invalid Employee ID checksum or format' });
    }

    const employee = await authRepo.findEmployeeByFpId(fpEmployeeId);
    if (!employee || employee.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'Invalid Employee ID or credentials' });
    }

    const user = await authRepo.findUserByEmployeeId(employee.id);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid Employee ID or credentials' });
    }

    const isMatch = await verifyPassword(user.password_hash, password);
    if (!isMatch) {
      return reply.code(401).send({ error: 'Invalid Employee ID or credentials' });
    }

    const policyCheck = AuthPolicy.canLogin(user);
    if (!policyCheck.allowed) {
      return reply.code(403).send({ error: policyCheck.reason });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: 'EMPLOYEE',
      employeeId: employee.id,
      orgId: employee.organization_id,
    });

    await safeCreateRefreshToken(user.id, request, reply);
    await authRepo.updateLastLogin(user.id);

    return reply.send({
      accessToken,
      user: {
        id: user.id,
        role: 'EMPLOYEE',
        fpEmployeeId: employee.fp_employee_id,
        fullName: employee.full_name,
        orgId: employee.organization_id,
        mustChangePassword: user.must_change_password,
      },
    });
  });

  // --------------------------------------------------------------------------
  // 6. Employee Forgot Password -> Request to Organization Admin
  // --------------------------------------------------------------------------
  fastify.post('/auth/employee/forgot-password', async (request, reply) => {
    const parse = forgotPasswordSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
    }

    const { fpEmployeeId, phoneNumber, deliveryMethod } = parse.data;
    const validation = validateEmployeeId(fpEmployeeId);
    if (!validation.valid) {
      return reply.code(400).send({ error: 'Invalid Employee ID checksum or format' });
    }

    const employee = await authRepo.findEmployeeByFpId(fpEmployeeId);
    if (!employee || employee.phone_number !== phoneNumber) {
      // Return 200 with generic message for privacy / anti-enumeration
      return reply.send({
        message: 'If the provided Employee ID and registered phone number match our records, your password reset request has been routed to your company administrator for approval.',
      });
    }

    await authRepo.createPasswordResetRequest({
      employeeId: employee.id,
      deliveryMethod,
    });

    return reply.send({
      message: 'Your password reset request has been submitted to your organization administrator for approval.',
    });
  });

  // --------------------------------------------------------------------------
  // 7. Token Refresh (Rotation)
  // --------------------------------------------------------------------------
  fastify.post('/auth/refresh', async (request, reply) => {
    const rawToken = request.cookies.refresh_token || request.body?.refreshToken;
    if (!rawToken) {
      return reply.code(401).send({ error: 'Missing refresh token' });
    }

    const record = await sessionRepo.findAndRotateRefreshToken(rawToken);
    if (!record) {
      return reply.code(401).send({ error: 'Refresh token invalid, expired, or revoked' });
    }

    const user = await authRepo.findUserById(record.user_id);
    if (!user || user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'User account inactive or not found' });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      orgId: user.organization_id,
      merchantId: user.merchant_id,
      employeeId: user.employee_id,
    });

    const newRawRefreshToken = await sessionRepo.createRefreshToken(user.id, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    setRefreshTokenCookie(reply, newRawRefreshToken);

    return reply.send({
      accessToken,
    });
  });

  // --------------------------------------------------------------------------
  // 8. Logout
  // --------------------------------------------------------------------------
  fastify.post('/auth/logout', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user?.sub) {
      await sessionRepo.revokeAllForUser(request.user.sub);
    }
    const isProduction = process.env.NODE_ENV === 'production';
    reply.clearCookie('refresh_token', {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });
    return reply.send({ message: 'Successfully logged out' });
  });
}

module.exports = authRoutes;
