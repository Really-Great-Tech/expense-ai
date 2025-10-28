import { Body, Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { Roles } from './custom.decorator';

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

  @Get('/echo')
  getEcho(@Req() req, @Res() res, @Body() body) {
    // Add security headers
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    res.status(200).json(body);
  }

  @Get('/premium-echo')
  getPremiumEcho(@Req() req, @Res() res, @Body() body) {
    // Add security headers
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    res.status(200).json(body);
  }
}
