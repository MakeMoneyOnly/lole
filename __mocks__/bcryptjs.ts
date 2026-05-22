const mockHash = async (pin: string) => `$2b$10$mockedhash${pin}`;
const mockCompare = async (pin: string) => pin === '1234';

export default {
    hash: mockHash,
    compare: mockCompare,
};