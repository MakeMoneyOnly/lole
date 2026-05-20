import { hashStaffPinBcrypt, verifyStoredStaffPinBcrypt } from './pin';

export class PinService {
    async hash(pin: string): Promise<string> {
        return hashStaffPinBcrypt(pin);
    }

    async verify(storedPin: string | null | undefined, candidatePin: string): Promise<boolean> {
        return verifyStoredStaffPinBcrypt(storedPin, candidatePin);
    }
}

export const pinService = new PinService();