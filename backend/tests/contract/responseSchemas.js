const { z } = require('zod');

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']),
  full_name: z.string().nullable().optional(),
});

const ErrorSchema = z.object({ error: z.string() });
const MessageSchema = z.object({ message: z.string() });
const SuccessSchema = z.object({ success: z.literal(true) });

module.exports = {
  // Auth
  'POST /api/v1/auth/login': z.object({
    accessToken: z.string(),
    user: UserSchema,
  }),

  'POST /api/v1/auth/refresh': z.object({
    accessToken: z.string(),
    user: UserSchema,
  }),

  'POST /api/v1/auth/logout': MessageSchema,

  'GET /api/v1/auth/csrf-token': z.object({ csrfToken: z.string() }),

  'POST /api/v1/auth/forgot-password': MessageSchema,

  'POST /api/v1/auth/verify-email': MessageSchema,

  // Users
  'GET /api/v1/users/me': UserSchema,

  'GET /api/v1/users': z.object({
    data: z.array(UserSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  }),

  'PATCH /api/v1/users/me': MessageSchema,

  'PATCH /api/v1/users/me/password': MessageSchema,

  'PATCH /api/v1/users/:id/suspend': MessageSchema,

  'PATCH /api/v1/users/:id/activate': MessageSchema,

  'DELETE /api/v1/users/:id': MessageSchema,

  // Departments
  'POST /api/v1/departments': z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),

  'GET /api/v1/departments': z.array(
    z.object({ id: z.string().uuid(), name: z.string() })
  ),

  'DELETE /api/v1/departments/:id': z.object({
    success: z.literal(true),
    force: z.boolean(),
  }),

  // Notifications
  'GET /api/v1/notifications': z.object({
    data: z.array(
      z.object({
        id: z.string().uuid(),
        message: z.string(),
        read: z.boolean(),
      })
    ),
    total: z.number().int(),
  }),

  'GET /api/v1/notifications/unread-count': z.object({
    unread: z.number().int(),
  }),

  'POST /api/v1/notifications/read-all': SuccessSchema,

  'PATCH /api/v1/notifications/:id/read': SuccessSchema,

  'DELETE /api/v1/notifications/:id': SuccessSchema,

  'DELETE /api/v1/notifications/all': SuccessSchema,

  // Attendance
  'POST /api/v1/attendance/mark': z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    date: z.string(),
    status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY']),
  }),

  'POST /api/v1/attendance/bulk': z.object({
    success: z.literal(true),
    count: z.number().int(),
    records: z.array(z.object({ id: z.string().uuid() })),
  }),

  // Shared error shape (used in assertions for 4xx responses)
  _error: ErrorSchema,
};
