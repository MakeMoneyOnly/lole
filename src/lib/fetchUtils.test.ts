import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    fetchWithTimeout,
    safeFetch,
    postJSON,
    isTimeoutError,
    isNetworkError,
} from './fetchUtils';

describe('fetchWithTimeout', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fetch with default timeout', async () => {
        const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

        const response = await fetchWithTimeout('https://example.com/api');

        expect(response.ok).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            'https://example.com/api',
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
    });

    it('should fetch with custom timeout', async () => {
        const mockResponse = new Response(null, { status: 200 });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

        await fetchWithTimeout('https://example.com/api', { timeout: 5000 });

        expect(fetch).toHaveBeenCalled();
    });

    it('should pass through fetch options', async () => {
        const mockResponse = new Response(null, { status: 200 });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

        await fetchWithTimeout('https://example.com/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true }),
        });

        expect(fetch).toHaveBeenCalledWith(
            'https://example.com/api',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: true }),
            })
        );
    });
});

describe('safeFetch', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return data on successful response', async () => {
        const mockResponse = new Response(JSON.stringify({ name: 'test' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

        const result = await safeFetch<{ name: string }>('https://example.com/api');

        expect(result.data).toEqual({ name: 'test' });
        expect(result.error).toBeNull();
        expect(result.status).toBe(200);
    });

    it('should return error on HTTP error', async () => {
        const mockResponse = new Response(null, {
            status: 404,
            statusText: 'Not Found',
        });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

        const result = await safeFetch('https://example.com/api');

        expect(result.data).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error?.message).toContain('404');
        expect(result.status).toBe(404);
    });

    it('should return error on network error', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

        const result = await safeFetch('https://example.com/api');

        expect(result.data).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
        expect(result.status).toBe(0);
    });

    it('should handle non-Error thrown values', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValueOnce('string error');

        const result = await safeFetch('https://example.com/api');

        expect(result.data).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error?.message).toBe('string error');
    });
});

describe('postJSON', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should post JSON data', async () => {
        const mockResponse = new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

        const result = await postJSON<{ success: boolean }>('https://example.com/api', {
            name: 'test',
        });

        expect(result.data).toEqual({ success: true });
        expect(fetch).toHaveBeenCalledWith(
            'https://example.com/api',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'test' }),
            })
        );
    });

    it('should use custom timeout', async () => {
        const mockResponse = new Response(JSON.stringify({}), { status: 200 });
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

        await postJSON('https://example.com/api', { data: 'test' }, 5000);

        expect(fetch).toHaveBeenCalled();
    });
});

describe('isTimeoutError', () => {
    it('should return true for AbortError', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        expect(isTimeoutError(error)).toBe(true);
    });

    it('should return true for timeout message', () => {
        const error = new Error('Request timeout');
        expect(isTimeoutError(error)).toBe(true);
    });

    it('should return true for aborted message', () => {
        const error = new Error('Request was aborted');
        expect(isTimeoutError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
        const error = new Error('Network failure');
        expect(isTimeoutError(error)).toBe(false);
    });
});

describe('isNetworkError', () => {
    it('should return true for fetch error', () => {
        const error = new Error('Failed to fetch');
        expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for network message', () => {
        const error = new Error('network error occurred');
        expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
        const error = new Error('Timeout');
        expect(isNetworkError(error)).toBe(false);
    });
});
