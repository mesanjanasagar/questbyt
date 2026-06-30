import { Router, IRouter } from 'express';
import { z } from 'zod';
import { login, refreshTokens, logout, heartbeat } from '../services/auth.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { DeviceType } from '@pos/shared-types';

const router: IRouter = Router();

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        username: z.string().min(1).max(255),
        password: z.string().min(6).max(128),
        deviceName: z.string().min(1).max(255),
        deviceType: z.nativeEnum(DeviceType),
        fcmToken: z.string().optional(),
      }),
      req.body,
    );

    const result = await login(body);
    res.status(200).json(successResponse(result, 'Login successful'));
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        refreshToken: z.string().min(1),
        deviceId: z.string().uuid(),
      }),
      req.body,
    );

    const result = await refreshTokens(body.refreshToken, body.deviceId);
    res.status(200).json(successResponse(result, 'Tokens refreshed'));
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout (requires valid JWT)
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await logout(req.user!.deviceId);
    res.status(200).json(successResponse(null, 'Logged out'));
  } catch (err) {
    next(err);
  }
});

// POST /auth/heartbeat (device keep-alive)
router.post('/heartbeat', authenticate, async (req, res, next) => {
  try {
    await heartbeat(req.user!.deviceId);
    res.status(200).json(successResponse({ ok: true }));
  } catch (err) {
    next(err);
  }
});

// GET /auth/me - return current user info from token
router.get('/me', authenticate, (req, res) => {
  res.status(200).json(successResponse(req.user));
});

export default router;