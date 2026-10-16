const { z } = require('zod');

// Normalizes and validates Ethiopian Safaricom telephone numbers
const phoneSchema = z
  .string()
  .trim()
  .transform((val) => {
    let clean = val.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '251' + clean.slice(1);
    if (!clean.startsWith('251')) clean = '251' + clean;
    return clean;
  })
  .refine(
    (val) => /^251[79]\d{8}$/.test(val),
    'Phone number must be a valid 12-digit Ethiopian Safaricom number (2517XXXXXXXX or 2519XXXXXXXX)'
  );

const orgRegisterSchema = z.object({
  orgName: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(100),
  tinNumber: z.string().trim().min(5, 'TIN number must be at least 5 characters').max(20),
  contactPhone: phoneSchema,
  mpesaShortcode: z.string().trim().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const orgLoginSchema = z.object({
  tinNumber: z.string().trim().min(1, 'TIN number is required'),
  password: z.string().min(1, 'Password is required'),
});

const merchantRegisterSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters').max(100),
  mpesaNumber: z.string().trim().min(4, 'Till/Paybill number is required').max(20),
  category: z.enum(['FOOD', 'TRANSPORT', 'HEALTH', 'GROCERY', 'FUEL', 'EDUCATION']),
  contactPhone: phoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const merchantLoginSchema = z.object({
  mpesaNumber: z.string().trim().min(1, 'M-PESA Till/Paybill number is required'),
  password: z.string().min(1, 'Password is required'),
});

const employeeLoginSchema = z.object({
  fpEmployeeId: z.string().trim().regex(/^FP-[A-Z]{2,4}-\d{4}-[0-9A-Z]{5}-[A-Z]$/, 'Invalid Employee ID format'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  fpEmployeeId: z.string().trim().regex(/^FP-[A-Z]{2,4}-\d{4}-[0-9A-Z]{5}-[A-Z]$/, 'Invalid Employee ID format'),
  phoneNumber: phoneSchema,
  deliveryMethod: z.enum(['SMS', 'MANUAL']).default('SMS'),
  reason: z.string().optional(),
});

module.exports = {
  phoneSchema,
  orgRegisterSchema,
  orgLoginSchema,
  merchantRegisterSchema,
  merchantLoginSchema,
  employeeLoginSchema,
  forgotPasswordSchema,
};
