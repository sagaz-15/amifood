import type { Account } from '../../domain/entities/account.ts';
import type { Store } from '../../domain/entities/store.ts';
import { UnauthorizedError } from '../../domain/errors/domain-error.ts';
import type { AuthProfile, LoginCommand, LoginResult } from '../dto/auth-dto.ts';
import type { AuthUseCases } from '../ports/in/auth-use-cases.ts';
import type { AccountRepository } from '../ports/out/account-repository.ts';
import type { PasswordHasher } from '../ports/out/password-hasher.ts';
import type { StoreRepository } from '../ports/out/store-repository.ts';
import type { TokenService } from '../ports/out/token-service.ts';

export interface AuthServiceDependencies {
  accounts: AccountRepository;
  stores: StoreRepository;
  passwordHasher: PasswordHasher;
  tokenService: TokenService;
  expiresIn: string;
}

/** Caso de uso de autenticacion: credenciales -> JWT firmado. */
export class AuthService implements AuthUseCases {
  private readonly accounts: AccountRepository;
  private readonly stores: StoreRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly tokenService: TokenService;
  private readonly expiresIn: string;

  constructor(dependencies: AuthServiceDependencies) {
    this.accounts = dependencies.accounts;
    this.stores = dependencies.stores;
    this.passwordHasher = dependencies.passwordHasher;
    this.tokenService = dependencies.tokenService;
    this.expiresIn = dependencies.expiresIn;
  }

  async login(command: LoginCommand): Promise<LoginResult> {
    const email = command.email.trim().toLowerCase();
    const credentials = await this.accounts.findCredentialsByEmail(email);

    // Mismo mensaje para usuario inexistente y contraseña incorrecta:
    // evita filtrar que correos estan registrados.
    const invalid = new UnauthorizedError(
      'AUTH_INVALID_CREDENTIALS',
      'Correo o contrasena incorrectos.',
    );

    if (!credentials || !credentials.account.isActive) {
      throw invalid;
    }

    const matches = await this.passwordHasher.compare(command.password, credentials.passwordHash);
    if (!matches) {
      throw invalid;
    }

    const account = credentials.account;
    const token = this.tokenService.sign({
      accountId: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      storeId: account.storeId,
    });
    const store = await this.findStore(account);

    return { token, expiresIn: this.expiresIn, account, store };
  }

  async getProfile(accountId: string): Promise<AuthProfile> {
    const account = await this.accounts.findById(accountId);
    if (!account || !account.isActive) {
      throw new UnauthorizedError('AUTH_ACCOUNT_INACTIVE', 'La cuenta no existe o esta inactiva.');
    }
    const store = await this.findStore(account);
    return { account, store };
  }

  private async findStore(account: Account): Promise<Store | null> {
    if (!account.storeId) return null;
    return this.stores.findById(account.storeId);
  }
}
