import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { AccountRole } from '../../../../domain/entities/account.ts';
import { UnauthorizedError } from '../../../../domain/errors/domain-error.ts';
import type { TokenClaims, TokenService } from '../../../../application/ports/out/token-service.ts';

const ISSUER = 'amifood-api';
const ROLES: readonly AccountRole[] = ['ADMIN', 'ENCARGADO'];

/** Adaptador de salida del puerto TokenService usando JWT firmado (HS256). */
export class JwtTokenService implements TokenService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(secret: string, expiresIn: string) {
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  sign(claims: TokenClaims): string {
    const options: SignOptions = {
      expiresIn: this.expiresIn as SignOptions['expiresIn'],
      subject: claims.accountId,
      issuer: ISSUER,
    };
    return jwt.sign(
      {
        name: claims.name,
        email: claims.email,
        role: claims.role,
        storeId: claims.storeId,
      },
      this.secret,
      options,
    );
  }

  verify(token: string): TokenClaims {
    try {
      const decoded = jwt.verify(token, this.secret, { issuer: ISSUER });
      if (typeof decoded === 'string' || !decoded.sub) {
        throw new Error('Payload de token invalido');
      }
      const { name, email, role, storeId } = decoded as jwt.JwtPayload & {
        name?: unknown;
        email?: unknown;
        role?: unknown;
        storeId?: unknown;
      };
      if (typeof name !== 'string' || typeof email !== 'string' || !ROLES.includes(role as AccountRole)) {
        throw new Error('Claims incompletos');
      }
      return {
        accountId: decoded.sub,
        name,
        email,
        role: role as AccountRole,
        storeId: typeof storeId === 'string' ? storeId : null,
      };
    } catch {
      throw new UnauthorizedError('TOKEN_INVALID', 'Token invalido o expirado.');
    }
  }
}
