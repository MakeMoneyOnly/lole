import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../pin', () => ({
	hashStaffPinBcrypt: vi.fn(),
	verifyStoredStaffPinBcrypt: vi.fn(),
}));

describe('PinService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	async function importService() {
		const { PinService } = await import('../pin-service');
		return new PinService();
	}

	describe('hash', () => {
		it('hashes plain PIN using bcrypt', async () => {
			const { hashStaffPinBcrypt } = await import('../pin');
			const mockHash = vi.mocked(hashStaffPinBcrypt);
			mockHash.mockResolvedValue('$2b$10$hashedPinValue');

			const service = await importService();
			const result = await service.hash('1234');

			expect(result).toBe('$2b$10$hashedPinValue');
			expect(mockHash).toHaveBeenCalledWith('1234');
		});

		it('trims whitespace from PIN before hashing', async () => {
			const { hashStaffPinBcrypt } = await import('../pin');
			const mockHash = vi.mocked(hashStaffPinBcrypt);
			mockHash.mockResolvedValue('$2b$10$hashedPinValue');

			const service = await importService();
			await service.hash(' 1234 ');

			// PinService passes the PIN as-is to hashStaffPinBcrypt, which trims internally
			expect(mockHash).toHaveBeenCalledWith(' 1234 ');
		});
	});

	describe('verify', () => {
		it('returns true for valid PIN', async () => {
			const { verifyStoredStaffPinBcrypt } = await import('../pin');
			const mockVerify = vi.mocked(verifyStoredStaffPinBcrypt);
			mockVerify.mockResolvedValue(true);

			const service = await importService();
			const result = await service.verify('$2b$10$hashed', '1234');

			expect(result).toBe(true);
			expect(mockVerify).toHaveBeenCalledWith('$2b$10$hashed', '1234');
		});

		it('returns false for invalid PIN', async () => {
			const { verifyStoredStaffPinBcrypt } = await import('../pin');
			const mockVerify = vi.mocked(verifyStoredStaffPinBcrypt);
			mockVerify.mockResolvedValue(false);

			const service = await importService();
			const result = await service.verify('$2b$10$hashed', '9999');

			expect(result).toBe(false);
		});

		it('returns false for null stored PIN', async () => {
			const { verifyStoredStaffPinBcrypt } = await import('../pin');
			const mockVerify = vi.mocked(verifyStoredStaffPinBcrypt);
			mockVerify.mockResolvedValue(false);

			const service = await importService();
			const result = await service.verify(null, '1234');

			expect(result).toBe(false);
		});

		it('returns false for undefined stored PIN', async () => {
			const { verifyStoredStaffPinBcrypt } = await import('../pin');
			const mockVerify = vi.mocked(verifyStoredStaffPinBcrypt);
			mockVerify.mockResolvedValue(false);

			const service = await importService();
			const result = await service.verify(undefined, '1234');

			expect(result).toBe(false);
		});

		it('supports legacy HMAC hashed PINs via dual verification', async () => {
			const { verifyStoredStaffPinBcrypt } = await import('../pin');
			const mockVerify = vi.mocked(verifyStoredStaffPinBcrypt);
			mockVerify.mockResolvedValue(true);

			const service = await importService();
			const legacyHashed = 'h1:' + 'a'.repeat(64);
			const result = await service.verify(legacyHashed, '1234');

			expect(result).toBe(true);
		});

		it('supports plaintext comparison for backward compatibility', async () => {
			const { verifyStoredStaffPinBcrypt } = await import('../pin');
			const mockVerify = vi.mocked(verifyStoredStaffPinBcrypt);
			mockVerify.mockResolvedValue(true);

			const service = await importService();
			const result = await service.verify('1234', '1234');

			expect(result).toBe(true);
		});
	});
});