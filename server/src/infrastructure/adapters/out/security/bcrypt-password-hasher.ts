import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../../../../application/ports/out/password-hasher.ts';

/** Adaptador de salida del puerto PasswordHasher con bcrypt. */
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly rounds: number;

  constructor(rounds = 10) {
    this.rounds = rounds;
  }

  compare(plainText: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainText, passwordHash);
  }

  hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.rounds);
  }
}
