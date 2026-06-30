import { Router, type IRouter, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import * as forecastService from '../services/forecast.service';

const router: IRouter = Router();

// Get forecasts
router.get('/forecasts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.query;

    const forecasts = await forecastService.getForecasts(
      req.user!.storeId,
      date as string | undefined
    );

    const summary = {
      totalOrders: forecasts.reduce((sum, f) => sum + f.predictedOrders, 0),
      totalRevenue: forecasts.reduce((sum, f) => sum + (f.predictedRevenue || 0), 0),
      avgConfidence: forecasts.length > 0
        ? Math.round((forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length) * 100) / 100
        : 0,
    };

    res.json({ success: true, data: forecasts, summary });
  } catch (err) {
    next(err);
  }
});

// Get shift recommendations
router.get('/recommendations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recommendations = await forecastService.getShiftRecommendations(req.user!.storeId);
    res.json({ success: true, data: recommendations, count: recommendations.length });
  } catch (err) {
    next(err);
  }
});

// Get alerts
router.get('/alerts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await forecastService.getAlerts(req.user!.storeId);
    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    next(err);
  }
});

// Manual trigger forecast generation
router.post('/generate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await forecastService.generateForecast(req.user!.storeId);
    res.json({ success: true, message: 'Forecast generation initiated' });
  } catch (err) {
    next(err);
  }
});

export default router;