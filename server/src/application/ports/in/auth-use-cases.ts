import type { AuthProfile, LoginCommand, LoginResult } from '../../dto/auth-dto.ts';

/** PUERTO DE ENTRADA para autenticacion. */
export interface AuthUseCases {
  login(command: LoginCommand): Promise<LoginResult>;
  getProfile(accountId: string): Promise<AuthProfile>;
}
