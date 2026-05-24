import { existsSync, rmSync } from 'fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Set required env var before importing the module
process.env.DEVICE_TOKEN_SIGNATURE_SECRET = 'test-secret-key-that-is-long-enough-32ch';

// Now import the module
import { getStandaloneGatewayConfig, initPersistentStorage } from '@/lib/gateway/entrypoint';

const testDir = join(process.cwd(), '.tmp-gateway-test');

describe('gateway entrypoint helpers', () => {
    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
        delete process.env.RESTAURANT_ID;
        delete process.env.LOCATION_ID;
        delete process.env.GATEWAY_BOOTSTRAP_SECRET;
        delete process.env.STORE_GATEWAY_DATA_DIR;
        delete process.env.GATEWAY_HEALTH_PORT;
        delete process.env.LAN_MQTT_URL;
        delete process.env.GATEWAY_HOST;
        delete process.env.GATEWAY_ID;
    });

    it('loads standalone gateway config from env', () => {
        process.env.RESTAURANT_ID = 'rest-1';
        process.env.LOCATION_ID = 'loc-1';
        process.env.GATEWAY_BOOTSTRAP_SECRET = 'bootstrap-secret';
        process.env.GATEWAY_HEALTH_PORT = '9787';
        process.env.GATEWAY_HOST = '10.0.0.5';
        process.env.LAN_MQTT_URL = 'ws://10.0.0.5:1884/mqtt';

        const config = getStandaloneGatewayConfig();

        expect(config.gatewayId).toBe('gateway-loc-1');
        expect(config.port).toBe(9787);
        expect(config.host).toBe('10.0.0.5');
    });

    it('creates persistent journal file for standalone gateway', () => {
        const journalPath = initPersistentStorage(testDir);

        expect(existsSync(journalPath)).toBe(true);
    });

    it('throws on missing required env vars', () => {
        delete process.env.RESTAURANT_ID;
        delete process.env.LOCATION_ID;
        delete process.env.GATEWAY_BOOTSTRAP_SECRET;

        expect(() => getStandaloneGatewayConfig()).toThrow();
    });

    it('uses custom GATEWAY_ID when set', () => {
        process.env.RESTAURANT_ID = 'rest-2';
        process.env.LOCATION_ID = 'loc-2';
        process.env.GATEWAY_BOOTSTRAP_SECRET = 'bootstrap-secret';
        process.env.GATEWAY_ID = 'custom-gw-id';

        const config = getStandaloneGatewayConfig();

        expect(config.gatewayId).toBe('custom-gw-id');
    });
});
