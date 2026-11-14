import type { Request, Response } from 'express';
import type { AuthUseCases } from '../../../../../application/ports/in/auth-use-cases.ts';
import type { LoginCommand } from '../../../../../application/dto/auth-dto.ts';
import { currentAccount } from '../middleware/authentication-middleware.ts';
import { presentAuthProfile } from '../presenters/product-presenter.ts';

/** Adaptador de entrada HTTP para autenticacion. */
export class AuthController {
  private readonly useCases: AuthUseCases;

  constructor(useCases: AuthUseCases) {
    this.useCases = useCases;
  }

  login = async (req: Request, res: Response): Promise<void> => {
    const command = res.locals.validated.body as LoginCommand;
    const result = await this.useCases.login(command);
    const profile = presentAuthProfile(result);
    res.status(200).json({
      token: result.token,
      tokenType: 'Bearer',
      expiresIn: result.expiresIn,
      ...profile,
    });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const account = currentAccount(res);
    const profile = await this.useCases.getProfile(account.id);
    res.status(200).json({ data: presentAuthProfile(profile) });
  };
}
