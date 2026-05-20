/**
 * Dependency Injection Container
 * Simple, type-safe container with singleton and transient lifetimes
 */

export type Token<T> = { readonly __type: T };

export function token<T>(_name: string): Token<T> {
  return { __type: undefined as T };
}

export interface Registration<T> {
  token: Token<T>;
  factory: () => T;
  lifetime: 'singleton' | 'transient';
  singletonInstance?: T;
}

export class Container {
  private registrations = new Map<unknown, Registration<unknown>>();

  register<T>(
    token: Token<T>,
    factory: () => T,
    lifetime: 'singleton' | 'transient' = 'transient'
  ): this {
    this.registrations.set(token, {
      token,
      factory: factory as () => unknown,
      lifetime,
    });
    return this;
  }

  resolve<T>(token: Token<T>): T {
    const registration = this.registrations.get(token);
    
    if (!registration) {
      throw new Error(`No registration found for token: ${String(token)}`);
    }

    if (registration.lifetime === 'singleton') {
      if (registration.singletonInstance === undefined) {
        registration.singletonInstance = registration.factory();
      }
      return registration.singletonInstance as T;
    }

    return registration.factory() as T;
  }

  tryResolve<T>(token: Token<T>): T | undefined {
    const registration = this.registrations.get(token);
    
    if (!registration) {
      return undefined;
    }

    if (registration.lifetime === 'singleton') {
      if (registration.singletonInstance === undefined) {
        registration.singletonInstance = registration.factory();
      }
      return registration.singletonInstance as T;
    }

    return registration.factory() as T;
  }

  has(token: Token<unknown>): boolean {
    return this.registrations.has(token);
  }

  reset(): void {
    this.registrations.forEach((registration) => {
      if (registration.lifetime === 'singleton') {
        delete registration.singletonInstance;
      }
    });
  }
}

export const container = new Container();