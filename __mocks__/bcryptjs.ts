const mockBcrypt = {
    hash: async (pin: string) => `$2b$10$mockedhash${pin}`,
    compare: async (pin: string) => pin === '1234',
};

module.exports = mockBcrypt;
