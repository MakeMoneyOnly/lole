import { describe, it, expect, beforeEach } from 'vitest';
import { Container, token } from '../container';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('transient lifetime', () => {
    it('creates new instance each time', () => {
      const counterToken = token<number>('counter');
      let count = 0;
      
      container.register(counterToken, () => ++count, 'transient');
      
      const instance1 = container.resolve(counterToken);
      const instance2 = container.resolve(counterToken);
      
      expect(instance1).toBe(1);
      expect(instance2).toBe(2);
    });
  });

  describe('singleton lifetime', () => {
    it('returns same instance each time', () => {
      interface TestService {
        id: string;
      }
      
      const serviceToken = token<TestService>('testService');
      let instanceCount = 0;
      
      container.register(
        serviceToken,
        () => ({ id: `instance-${++instanceCount}` }),
        'singleton'
      );
      
      const instance1 = container.resolve(serviceToken);
      const instance2 = container.resolve(serviceToken);
      
      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe('instance-1');
      expect(instance2.id).toBe('instance-1');
    });
  });

  describe('resolve', () => {
    it('throws error for unregistered token', () => {
      const unknownToken = token<string>('unknown');
      
      expect(() => container.resolve(unknownToken)).toThrow(
        'No registration found for token'
      );
    });
  });

  describe('tryResolve', () => {
    it('returns undefined for unregistered token', () => {
      const unknownToken = token<string>('unknown');
      
      const result = container.tryResolve(unknownToken);
      
      expect(result).toBeUndefined();
    });

    it('returns resolved instance for registered token', () => {
      const serviceToken = token<{ value: string }>('service');
      container.register(serviceToken, () => ({ value: 'test' }), 'singleton');
      
      const result = container.tryResolve(serviceToken);
      
      expect(result).toEqual({ value: 'test' });
    });
  });

  describe('has', () => {
    it('returns true when token is registered', () => {
      const serviceToken = token<string>('service');
      container.register(serviceToken, () => 'value');
      
      expect(container.has(serviceToken)).toBe(true);
    });

    it('returns false when token is not registered', () => {
      const unknownToken = token<string>('unknown');
      
      expect(container.has(unknownToken)).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets singleton instances', () => {
      interface TestService {
        id: string;
      }
      
      const serviceToken = token<TestService>('testService');
      let instanceCount = 0;
      
      container.register(
        serviceToken,
        () => ({ id: `instance-${++instanceCount}` }),
        'singleton'
      );
      
      const instance1 = container.resolve(serviceToken);
      expect(instance1.id).toBe('instance-1');
      
      container.reset();
      
      const instance2 = container.resolve(serviceToken);
      expect(instance2.id).toBe('instance-2');
    });
  });

  describe('method chaining', () => {
    it('returns this for chaining', () => {
      const token1 = token<string>('service1');
      const token2 = token<string>('service2');
      
      const result = container
        .register(token1, () => 'service1')
        .register(token2, () => 'service2');
      
      expect(result).toBe(container);
    });
  });
});