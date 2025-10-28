import { Body, Injectable, Req, Res } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      message: 'Hello World!',
    };
  }

  // Health check moved to HealthController - this method is deprecated
  // Use GET /health for comprehensive health checks
}
