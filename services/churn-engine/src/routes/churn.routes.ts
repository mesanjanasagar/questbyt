import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateOrThrow } from '@pos/shared-utils';
import { authenticate } from '../middleware/authenticate';
import * as scoringService from '../services/scoring.service';

const router = Router();

// Get churn scores for a store
router.get('/scores', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { riskLevel } = req.query;
    const storeId = req.user!.storeId;

    const scores = await scoringService.getChurnScores(
      storeId,
      riskLevel as string | undefined
    );

    const summary = {
      total: scores.length,
      critical: scores.filter(s => s.riskLevel === 'critical').length,
      high: scores.filter(s => s.riskLevel === 'high').length,
      medium: scores.filter(s => s.riskLevel === 'medium').length,
      low: scores.filter(s => s.riskLevel === 'low').length,
    };

    res.json({ success: true, data: scores, summary });
  } catch (err) {
    next(err);
  }
});

// Manual trigger scoring
router.post('/score', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    await scoringService.scoreAllCustomers(storeId);
    res.json({ success: true, message: 'Scoring initiated' });
  } catch (err) {
    next(err);
  }
});

export default router;