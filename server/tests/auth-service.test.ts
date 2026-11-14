import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/application/services/auth-service.ts';
import type {
  AccountCredentials,
  AccountRepository,
} from '../src/application/ports/out/account-repository.ts';
import type { PasswordHasher } from '../src/application/ports/out/password-hasher.ts';
import type { StoreRepository } from '../src/application/ports/out/store-repository.ts';
import type { TokenClaims, TokenService } from '../src/application/ports/out/token-service.ts';
import type { Account } from '../src/domain/entities/account.ts';
import type { Store } from '../src/domain/entities/store.ts';
import { UnauthorizedError } from '../src/domain/errors/domain-error.ts';

const STORE: Store = {
  id: 'store-a',
  name: 'Local A',
  description: null,
  location: null,
  imageUrl: null,
  isActive: true,
};

const ACCOUNT: Account = {
  id: 'account-a',
  name: 'Encargado A',
  email: 'owner@amifood.com',
  role: 'ENCARGADO',
  storeId: STORE.id,
  isActive: true,
};

class FakeAccountRepository implements AccountRepository {
  private readonly credentials: AccountCredentials | null;

  constructor(credentials: AccountCredentials | null) {
    this.credentials = credentials;
  }

  async findByEmail(): Promise<Account | null> {
    return this.credentials?.account ?? null;
  }
  async findCredentialsByEmail(): Promise<AccountCredentials | null> {
    return this.credentials;
  }
  async findById(id: string): Promise<Account | null> {
    return this.credentials && this.credentials.account.id === id ? this.credentials.account : null;
  }
}

class FakeHasher implements PasswordHasher {
  async compare(plainText: string, passwordHash: string): Promise<boolean> {
    return plainText === passwordHash;
  }
  async hash(plainText: string): Promise<string> {
    return plainText;
  }
}

class FakeTokenService implements TokenService {
  sign(claims: TokenClaims): string {
    return `token-${claims.accountId}`;
  }
  verify(token: string): TokenClaims {
    return {
      accountId: token.replace('token-', ''),
      name: ACCOUNT.name,
      email: ACCOUNT.email,
      role: ACCOUNT.role,
      storeId: ACCOUNT.storeId,
    };
  }
}

class FakeStoreRepository implements StoreRepository {
  async findById(id: string): Promise<Store | null> {
    return id === STORE.id ? STORE : null;
  }
}

function build(account: Account | null, passwordHash = 'secreto') {
  const credentials = account ? { account, passwordHash } : null;
  return new AuthService({
    accounts: new FakeAccountRepository(credentials),
    stores: new FakeStoreRepository(),
    passwordHasher: new FakeHasher(),
    tokenService: new FakeTokenService(),
    expiresIn: '24h',
  });
}

test('login valido devuelve token, cuenta y local', async () => {
  const service = build(ACCOUNT);
  const result = await service.login({ email: 'OWNER@amifood.com', password: 'secreto' });

  assert.equal(result.token, 'token-account-a');
  assert.equal(result.account.id, ACCOUNT.id);
  assert.equal(result.store?.name, STORE.name);
});

test('login con contrasena incorrecta responde 401 de dominio', async () => {
  const service = build(ACCOUNT);
  await assert.rejects(
    () => service.login({ email: 'owner@amifood.com', password: 'incorrecta' }),
    (error: unknown) => error instanceof UnauthorizedError && error.code === 'AUTH_INVALID_CREDENTIALS',
  );
});

test('login de cuenta inexistente o inactiva usa el mismo error', async () => {
  const missing = build(null);
  await assert.rejects(
    () => missing.login({ email: 'nadie@amifood.com', password: 'x' }),
    (error: unknown) => error instanceof UnauthorizedError,
  );

  const inactive = build({ ...ACCOUNT, isActive: false });
  await assert.rejects(
    () => inactive.login({ email: ACCOUNT.email, password: 'secreto' }),
    (error: unknown) => error instanceof UnauthorizedError,
  );
});
