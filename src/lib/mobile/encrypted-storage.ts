import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';

const ENCRYPTION_KEY_ID = 'lole_encryption_key_v1';
const ENCRYPTED_STORE_PREFIX = 'enc_';

interface KeychainPlugin {
    get: (options: { key: string }) => Promise<{ value: string | null }>;
    set: (options: { key: string; value: string }) => Promise<void>;
    remove: (options: { key: string }) => Promise<void>;
}

async function getKeychainPlugin(): Promise<KeychainPlugin | null> {
    if (!isCapacitorNativeRuntime()) {
        return null;
    }

    try {
        const importer = new Function('moduleName', 'return import(moduleName);') as (
            value: string
        ) => Promise<{ Preferences?: KeychainPlugin }>;
        // Use @capacitor/preferences for encrypted storage on Android (Keystore-backed)
        // On Android, EncryptedSharedPreferences uses Android Keystore under the hood
        const mod = await importer('@capacitor/preferences');
        return mod?.Preferences as KeychainPlugin | null;
    } catch {
        return null;
    }
}

async function getEncryptionKey(): Promise<string | null> {
    const keychain = await getKeychainPlugin();

    if (keychain) {
        try {
            const entry = await keychain.get({ key: ENCRYPTION_KEY_ID });
            if (entry.value) {
                return entry.value;
            }
        } catch {
            // Key not found, generate new one
        }
    }

    const newKey = generateEncryptionKey();

    if (keychain) {
        try {
            await keychain.set({ key: ENCRYPTION_KEY_ID, value: newKey });
        } catch {
            // Fall through — key stored in memory only this session
        }
    }

    return newKey;
}

function generateEncryptionKey(): string {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);
    return btoa(String.fromCharCode(...rawKey));
}

async function importCryptoKey(base64Key: string, usage: KeyUsage[]): Promise<CryptoKey> {
    const rawKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, usage);
}

async function simpleEncrypt(plaintext: string, base64Key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await importCryptoKey(base64Key, ['encrypt']);

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

async function simpleDecrypt(ciphertext: string, base64Key: string): Promise<string | null> {
    try {
        const raw = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
        const iv = raw.slice(0, 12);
        const data = raw.slice(12);

        const cryptoKey = await importCryptoKey(base64Key, ['decrypt']);

        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);

        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
}

export async function encryptStore(key: string, value: string): Promise<boolean> {
    try {
        const encryptionKey = await getEncryptionKey();
        if (!encryptionKey) {
            return false;
        }

        const encrypted = await simpleEncrypt(value, encryptionKey);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ENCRYPTED_STORE_PREFIX + key, encrypted);
        }

        return true;
    } catch {
        return false;
    }
}

export async function decryptGet(key: string): Promise<string | null> {
    try {
        if (typeof window === 'undefined') {
            return null;
        }

        const encrypted = window.localStorage.getItem(ENCRYPTED_STORE_PREFIX + key);
        if (!encrypted) {
            return null;
        }

        const encryptionKey = await getEncryptionKey();
        if (!encryptionKey) {
            return null;
        }

        return await simpleDecrypt(encrypted, encryptionKey);
    } catch {
        return null;
    }
}

export async function encryptRemove(key: string): Promise<void> {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(ENCRYPTED_STORE_PREFIX + key);
    }
}

export async function rotateEncryptionKey(): Promise<boolean> {
    try {
        const oldKey = await getEncryptionKey();
        if (!oldKey) {
            return false;
        }

        const newKey = generateEncryptionKey();
        const keychain = await getKeychainPlugin();

        if (keychain) {
            await keychain.set({ key: ENCRYPTION_KEY_ID, value: newKey });
        }

        if (typeof window !== 'undefined') {
            const keys: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
                const storageKey = window.localStorage.key(i);
                if (storageKey?.startsWith(ENCRYPTED_STORE_PREFIX)) {
                    keys.push(storageKey);
                }
            }

            for (const storageKey of keys) {
                const encrypted = window.localStorage.getItem(storageKey);
                if (encrypted) {
                    const decrypted = await simpleDecrypt(encrypted, oldKey);
                    if (decrypted) {
                        const reencrypted = await simpleEncrypt(decrypted, newKey);
                        window.localStorage.setItem(storageKey, reencrypted);
                    }
                }
            }
        }

        return true;
    } catch {
        return false;
    }
}
