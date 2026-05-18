import { describe, it, expect } from 'vitest';
import {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    RateLimitError,
} from './errors';

describe('AppError', () => {
    it('should create an AppError with all properties', () => {
        const error = new AppError(404, 'Not found', 'Item does not exist', 'NOT_FOUND');

        expect(error.statusCode).toBe(404);
        expect(error.userMessage).toBe('Not found');
        expect(error.internalMessage).toBe('Item does not exist');
        expect(error.code).toBe('NOT_FOUND');
        expect(error.name).toBe('AppError');
        expect(error.message).toBe('Not found');
    });

    it('should create an AppError without optional properties', () => {
        const error = new AppError(500, 'Server error');

        expect(error.statusCode).toBe(500);
        expect(error.userMessage).toBe('Server error');
        expect(error.internalMessage).toBeUndefined();
        expect(error.code).toBeUndefined();
    });

    it('should be an instance of Error', () => {
        const error = new AppError(400, 'Bad request');
        expect(error).toBeInstanceOf(Error);
    });
});

describe('ValidationError', () => {
    it('should create a ValidationError with default message', () => {
        const error = new ValidationError();

        expect(error.statusCode).toBe(400);
        expect(error.userMessage).toBe('Validation failed');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.name).toBe('ValidationError');
    });

    it('should create a ValidationError with custom message', () => {
        const error = new ValidationError('Invalid email format');

        expect(error.userMessage).toBe('Invalid email format');
    });

    it('should create a ValidationError with details', () => {
        const details = [
            { path: 'email', message: 'Invalid email' },
            { path: 'password', message: 'Too short' },
        ];
        const error = new ValidationError('Validation failed', details);

        expect(error.details).toEqual(details);
    });

    it('should be an instance of AppError', () => {
        const error = new ValidationError();
        expect(error).toBeInstanceOf(AppError);
    });
});

describe('AuthenticationError', () => {
    it('should create an AuthenticationError with default message', () => {
        const error = new AuthenticationError();

        expect(error.statusCode).toBe(401);
        expect(error.userMessage).toBe('Authentication required');
        expect(error.code).toBe('AUTHENTICATION_ERROR');
        expect(error.name).toBe('AuthenticationError');
    });

    it('should create an AuthenticationError with custom message', () => {
        const error = new AuthenticationError('Invalid credentials');

        expect(error.userMessage).toBe('Invalid credentials');
    });

    it('should be an instance of AppError', () => {
        const error = new AuthenticationError();
        expect(error).toBeInstanceOf(AppError);
    });
});

describe('AuthorizationError', () => {
    it('should create an AuthorizationError with default message', () => {
        const error = new AuthorizationError();

        expect(error.statusCode).toBe(403);
        expect(error.userMessage).toBe('Access denied');
        expect(error.code).toBe('AUTHORIZATION_ERROR');
        expect(error.name).toBe('AuthorizationError');
    });

    it('should create an AuthorizationError with custom message', () => {
        const error = new AuthorizationError('Insufficient permissions');

        expect(error.userMessage).toBe('Insufficient permissions');
    });

    it('should be an instance of AppError', () => {
        const error = new AuthorizationError();
        expect(error).toBeInstanceOf(AppError);
    });
});

describe('NotFoundError', () => {
    it('should create a NotFoundError with default message', () => {
        const error = new NotFoundError();

        expect(error.statusCode).toBe(404);
        expect(error.userMessage).toBe('Resource not found');
        expect(error.code).toBe('NOT_FOUND');
        expect(error.name).toBe('NotFoundError');
    });

    it('should create a NotFoundError with custom message', () => {
        const error = new NotFoundError('User not found');

        expect(error.userMessage).toBe('User not found');
    });

    it('should be an instance of AppError', () => {
        const error = new NotFoundError();
        expect(error).toBeInstanceOf(AppError);
    });
});

describe('RateLimitError', () => {
    it('should create a RateLimitError with default message', () => {
        const error = new RateLimitError();

        expect(error.statusCode).toBe(429);
        expect(error.userMessage).toBe('Too many requests');
        expect(error.code).toBe('RATE_LIMIT');
        expect(error.name).toBe('RateLimitError');
    });

    it('should create a RateLimitError with custom message', () => {
        const error = new RateLimitError('Rate limit exceeded, try again later');

        expect(error.userMessage).toBe('Rate limit exceeded, try again later');
    });

    it('should be an instance of AppError', () => {
        const error = new RateLimitError();
        expect(error).toBeInstanceOf(AppError);
    });
});
