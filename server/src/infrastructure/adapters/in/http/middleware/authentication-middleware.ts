import type { RequestHandler, Response } from 'express';
import type { AccountRepository } from '../../../../../application/ports/out/account-repository.ts';
import type { TokenService } from '../../../../../application/ports/out/token-service.ts';
import type { Account } from '../../../../../domain/entities/account.ts';
import { UnauthorizedError } from '../../../../../domain/errors/domain-error.ts';

/**
 * Middleware de seguridad (JWT Bearer). Valida el token y vuelve a consultar
 * la cuenta para detectar cuentas desactivadas despues de emitido el token.
 */
export class AuthenticationMiddleware {
  private readonly tokenService: TokenService;
  private readonly accounts: AccountRepository;

  constructor(tokenService: TokenService, accounts: AccountRepository) {
    this.tokenService = tokenService;
    this.accounts = accounts;
  }

  handle: RequestHandler = async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw new UnauthorizedError('TOKEN_REQUIRED', 'Debe enviar un token Bearer.');
      }

      const token = header.slice('Bearer '.length).trim();
      if (!token) {
        throw new UnauthorizedError('TOKEN_REQUIRED', 'Debe enviar un token Bearer.');
      }

      const claims = this.tokenService.verify(token);
      const account = await this.accounts.findById(claims.accountId);
      if (!account || !account.isActive) {
        throw new UnauthorizedError('TOKEN_INVALID', 'La cuenta no existe o esta inactiva.');
      }

      res.locals.account = account;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Recupera la cuenta autenticada que dejo el middleware. */
export function currentAccount(res: Response): Account {
  const account = res.locals.account as Account | undefined;
  if (!account) {
    throw new UnauthorizedError('TOKEN_REQUIRED', 'Debe autenticarse para realizar esta operacion.');
  }
  return account;
}
