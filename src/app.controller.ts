import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiExcludeController()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): object {
    return this.appService.getHello();
  }

  // Simple health check endpoint for backwards compatibility
  // For detailed health checks, use /health (see HealthController)
  @Get('/health-check')
  healthCheck(): object {
    return { message: 'up' };
  }
}
