export interface LocalFiscalSigningPayloadItem {
    name: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    total: number;
    item_code?: string | null;
}

export interface LocalFiscalSigningPayload {
    restaurant_tin: string;
    transaction_number: string;
    occurred_at: string;
    subtotal: number;
    tax_total: number;
    grand_total: number;
    order_id?: string | null;
    items: LocalFiscalSigningPayloadItem[];
}

export interface LocalFiscalSigningConfig {
    keyId: string;
    secret: string;
    algorithm: 'HMAC-SHA256';
}

export interface LocalFiscalSignatureEnvelope {
    keyId: string;
    algorithm: 'HMAC-SHA256';
    digest: string;
    signature: string;
    signedAt: string;
}

function bytesToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

function buildCanonicalItem(item: LocalFiscalSigningPayloadItem): string {
    return [
        item.item_code ?? '',
        item.name,
        item.quantity.toString(),
        item.unit_price.toFixed(2),
        item.tax_rate.toFixed(4),
        item.total.toFixed(2),
    ].join('|');
}

export function canonicalizeFiscalPayload(payload: LocalFiscalSigningPayload): string {
    const itemBody = payload.items.map(buildCanonicalItem).join(';');

    return [
        payload.restaurant_tin,
        payload.transaction_number,
        payload.occurred_at,
        payload.subtotal.toFixed(2),
        payload.tax_total.toFixed(2),
        payload.grand_total.toFixed(2),
        payload.order_id ?? '',
        itemBody,
    ].join('\n');
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function digestFiscalPayload(payload: LocalFiscalSigningPayload): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(canonicalizeFiscalPayload(payload))
    );

    return bytesToHex(digest);
}

export async function signFiscalPayload(
    payload: LocalFiscalSigningPayload,
    config: LocalFiscalSigningConfig
): Promise<LocalFiscalSignatureEnvelope> {
    const key = await importSigningKey(config.secret);
    const canonical = canonicalizeFiscalPayload(payload);
    const digest = await digestFiscalPayload(payload);
    const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical));

    return {
        keyId: config.keyId,
        algorithm: config.algorithm,
        digest,
        signature: bytesToHex(signed),
        signedAt: new Date().toISOString(),
    };
}

export async function verifyFiscalPayloadSignature(
    payload: LocalFiscalSigningPayload,
    envelope: LocalFiscalSignatureEnvelope,
    secret: string
): Promise<boolean> {
    const key = await importSigningKey(secret);
    const expectedDigest = await digestFiscalPayload(payload);

    if (expectedDigest !== envelope.digest) {
        return false;
    }

    const signatureBytes = Uint8Array.from(
        envelope.signature.match(/.{1,2}/g)?.map(byte => Number.parseInt(byte, 16)) ?? []
    );

    return await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        new TextEncoder().encode(canonicalizeFiscalPayload(payload))
    );
}

export function getLocalFiscalSigningConfig(): LocalFiscalSigningConfig | null {
    const secret = process.env.LOCAL_FISCAL_SIGNING_SECRET;
    if (!secret) {
        return null;
    }

    return {
        keyId: process.env.LOCAL_FISCAL_SIGNING_KEY_ID ?? 'local-edge-key-v1',
        secret,
        algorithm: 'HMAC-SHA256',
    };
}
