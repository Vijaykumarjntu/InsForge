import { Router, Response, NextFunction } from 'express';
import { AuthRequest, verifyUser } from '@/api/middlewares/auth.js';
import { messagingService } from '@/services/messaging/service.js';
import { AppError } from '@/utils/errors.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import { successResponse } from '@/utils/response.js';
import { NotificationChannel } from '@/types/messaging.js';

const router = Router();

/**
 * POST /api/messaging/dispatch
 * Send a notification through any unified channel (EMAIL, SMS, PUSH)
 */
router.post(
  '/dispatch',
//   verifyUser,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { channel, to, body, subject, title } = req.body;

      // 1. Core structural verification
      if (!channel || !to || !body) {
        throw new AppError(
          'Missing required input keys: channel, to, and body are mandatory payloads.',
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }

      // 2. Validate channel enum values explicitly
      const validChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH'];
      if (!validChannels.includes(channel as NotificationChannel)) {
        throw new AppError(
          `Invalid message channel type: must be one of ${validChannels.join(', ')}`,
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }

      // 3. Hand over execution directly to our unified service layer 
      // req.user?.id is extracted natively by the verifyUser middleware we imported above
      const deliveryResult = await messagingService.dispatch({
        recipientId: req.user?.id || 'anonymous-local-dev',
        channel: channel as NotificationChannel,
        to,
        body,
        subject,
        title
      });

      if (!deliveryResult.success) {
        throw new AppError(
          deliveryResult.error || 'Provider execution loop rejected message dispatch',
          500,
          ERROR_CODES.INTERNAL_ERROR
        );
      }

      // 4. Return standard response back to the platform interface
      successResponse(res, {
        message: 'Notification processed and tracked successfully.',
        providerMessageId: deliveryResult.providerMessageId
      });

    } catch (error) {
      next(error);
    }
  }
);

export const messagingRouter = router;