import type { Request } from 'express';
import { extractJwt } from './jwt.strategy';

const req = (authorization?: string): Request =>
  ({ headers: authorization === undefined ? {} : { authorization } }) as Request;

describe('extractJwt', () => {
  it('accepts the RealWorld "Token" scheme sent by the Angular interceptor', () => {
    expect(extractJwt(req('Token abc.def.ghi'))).toBe('abc.def.ghi');
  });

  it('accepts the "Bearer" scheme sent by Swagger UI and generic clients', () => {
    expect(extractJwt(req('Bearer abc.def.ghi'))).toBe('abc.def.ghi');
  });

  it('is case-insensitive about the scheme', () => {
    expect(extractJwt(req('token abc.def.ghi'))).toBe('abc.def.ghi');
    expect(extractJwt(req('BEARER abc.def.ghi'))).toBe('abc.def.ghi');
  });

  it('returns null when the header is absent, empty or unsupported', () => {
    expect(extractJwt(req())).toBeNull();
    expect(extractJwt(req(''))).toBeNull();
    expect(extractJwt(req('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(extractJwt(req('Token'))).toBeNull();
  });

  it('does not throw on a malformed request object', () => {
    expect(extractJwt(undefined as unknown as Request)).toBeNull();
    expect(extractJwt({} as Request)).toBeNull();
  });
});
