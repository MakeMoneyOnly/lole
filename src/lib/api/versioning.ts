/**
 * API Versioning Utilities
 *
 * Provides version detection and handling for the lole API.
 * Supports both URL-based versioning (/api/v1/) and header-based versioning.
 *
 * Header-based versioning:
 * - Accept: application/vnd.lole.v1+json (explicit v1)
 * - Accept: application/json (default, latest v1)
 *
 * @see docs/01-foundation/api-design.md
 */

import { NextRequest } from 'next/server';

export const API_VERSION = 'v1';
export const API_VERSION_HEADER = 'application/vnd.lole.v1+json';
export const API_DEFAULT_HEADER = 'application/json';

/**
 * Supported API versions
 */
export const SUPPORTED_API_VERSIONS = ['v1'] as const;
export type SupportedApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

/**
 * API version information returned in responses
 */
export interface ApiVersionInfo {
    version: SupportedApiVersion;
    deprecated: boolean;
    sunsetDate?: string;
    docsUrl: string;
}

/**
 * Get API version info for responses
 */
export function getApiVersionInfo(version: SupportedApiVersion = 'v1'): ApiVersionInfo {
    const versionMap: Record<SupportedApiVersion, ApiVersionInfo> = {
        v1: {
            version: 'v1',
            deprecated: false,
            docsUrl: '/docs/api/v1',
        },
    };

    return versionMap[version] || versionMap.v1;
}

/**
 * Parse Accept header to extract API version
 * Supports:
 * - application/vnd.lole.v1+json
 * - application/vnd.lole+json (default to latest)
 * - application/json (default to latest)
 */
export function parseVersionFromHeader(acceptHeader: string | null): SupportedApiVersion | null {
    if (!acceptHeader) {
        return null;
    }

    // Match custom vendor header: application/vnd.lole.v{version}+json
    const vendorMatch = acceptHeader.match(/application\/vnd\.lole\.v(\d+)\+json/);
    if (vendorMatch) {
        const version = `v${vendorMatch[1]}` as SupportedApiVersion;
        if (SUPPORTED_API_VERSIONS.includes(version)) {
            return version;
        }
    }

    return null;
}

/**
 * Detect API version from request
 * Priority: 1. Header (Accept), 2. URL path (/api/v1/), 3. Default (v1)
 */
export function detectApiVersion(request: NextRequest): SupportedApiVersion {
    // 1. Check Accept header first
    const acceptHeader = request.headers.get('accept');
    const headerVersion = parseVersionFromHeader(acceptHeader);
    if (headerVersion) {
        return headerVersion;
    }

    // 2. Check URL path for version prefix
    const url = request.nextUrl.pathname;
    const pathVersionMatch = url.match(/^\/api\/v(\d+)/);
    if (pathVersionMatch) {
        const version = `v${pathVersionMatch[1]}` as SupportedApiVersion;
        if (SUPPORTED_API_VERSIONS.includes(version)) {
            return version;
        }
    }

    // 3. Default to v1
    return 'v1';
}

/**
 * Check if request explicitly requests a specific version via header
 */
export function hasExplicitVersionHeader(request: NextRequest): boolean {
    const acceptHeader = request.headers.get('accept');
    if (!acceptHeader) {
        return false;
    }
    return acceptHeader.includes('application/vnd.lole.v');
}

/**
 * Create versioned response headers
 */
export function getVersionedHeaders(version: SupportedApiVersion = 'v1'): Record<string, string> {
    return {
        'API-Version': version,
        'Content-Type': API_VERSION_HEADER,
        'X-API-Version': version,
    };
}

/**
 * Create deprecation warning headers for responses
 */
export function getDeprecationHeaders(sunsetDate: string, docsUrl: string): Record<string, string> {
    return {
        Deprecation: `Sunset="${sunsetDate}"`,
        Link: `<${docsUrl}>; rel="deprecation"`,
    };
}

/**
 * API version middleware result
 */
export interface VersionMiddlewareResult {
    version: SupportedApiVersion;
    shouldRedirect: boolean;
    redirectPath?: string;
    isExplicitVersion: boolean;
}

/**
 * Process API version from request for middleware
 */
export function processApiVersion(request: NextRequest): VersionMiddlewareResult {
    const version = detectApiVersion(request);
    const isExplicitVersion = hasExplicitVersionHeader(request);

    // Check if URL needs redirect to versioned path
    const url = request.nextUrl.pathname;
    const isApiRoute = url.startsWith('/api/');
    const hasVersionPrefix = /^\/api\/v\d+/.test(url);

    let shouldRedirect = false;
    let redirectPath: string | undefined;

    // Redirect /api/* to /api/v1/* if no version in URL and no explicit header
    if (isApiRoute && !hasVersionPrefix && !isExplicitVersion) {
        // For now, we keep backward compatibility by NOT redirecting
        // The /api/* routes remain functional
        // This can be enabled in a future migration
        shouldRedirect = false;
    }

    return {
        version,
        shouldRedirect,
        redirectPath,
        isExplicitVersion,
    };
}

/**
 * Type guard for supported version
 */
export function isSupportedVersion(version: string): version is SupportedApiVersion {
    return SUPPORTED_API_VERSIONS.includes(version as SupportedApiVersion);
}

/**
 * Get the latest stable API version
 */
export function getLatestVersion(): SupportedApiVersion {
    return 'v1';
}
