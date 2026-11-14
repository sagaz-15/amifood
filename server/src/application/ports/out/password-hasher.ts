/** PUERTO DE SALIDA para verificacion de contraseñas. */
export interface PasswordHasher {
  compare(plainText: string, passwordHash: string): Promise<boolean>;
  hash(plainText: string): Promise<string>;
}
