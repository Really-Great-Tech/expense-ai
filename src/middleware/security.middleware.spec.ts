import 'reflect-metadata';
import { SecurityMiddleware } from './security.middleware';

describe('SecurityMiddleware', () => {
  let middleware: SecurityMiddleware;

  beforeEach(() => {
    middleware = new SecurityMiddleware();
  });

  function createMocks() {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
      }),
    } as any;

    const req = {} as any;
    const next = jest.fn();

    return { req, res, next, headers };
  }

  it('should set all expected security headers and call next', () => {
    const { req, res, next, headers } = createMocks();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', 'default-src \'self\'');
    expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Verify stored header values as a safety net
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains; preload');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Content-Security-Policy']).toBe('default-src \'self\'');
    expect(headers['Permissions-Policy']).toBe('geolocation=(), microphone=(), camera=()');

    expect(next).toHaveBeenCalledTimes(1);
  });
});
