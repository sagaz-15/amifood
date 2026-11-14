import { ValidationError } from '../errors/domain-error.ts';

const MAX_PRICE_CENTS = 100_000_000; // $1.000.000 COP

/**
 * Value Object de dinero. Internamente trabaja en centavos enteros para
 * evitar errores de punto flotante (RNF09 - integridad de datos).
 */
export class Money {
  readonly cents: number;

  private constructor(cents: number) {
    this.cents = cents;
  }

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new ValidationError('PRICE_INVALID', 'El precio debe expresarse en centavos enteros.');
    }
    if (cents <= 0) {
      throw new ValidationError('PRICE_INVALID', 'El precio debe ser mayor que cero.');
    }
    if (cents > MAX_PRICE_CENTS) {
      throw new ValidationError('PRICE_INVALID', 'El precio no puede superar $1.000.000 COP.');
    }
    return new Money(cents);
  }

  static fromDecimal(value: number): Money {
    if (!Number.isFinite(value)) {
      throw new ValidationError('PRICE_INVALID', 'El precio debe ser un numero valido.');
    }
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 1e-6) {
      throw new ValidationError('PRICE_INVALID', 'El precio admite como maximo dos decimales.');
    }
    return Money.fromCents(cents);
  }

  toDecimal(): number {
    return this.cents / 100;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  /** Variacion porcentual respecto a otro precio (positiva = aumento). */
  percentageDifferenceFrom(other: Money): number {
    if (other.cents === 0) return 0;
    return ((this.cents - other.cents) / other.cents) * 100;
  }
}
