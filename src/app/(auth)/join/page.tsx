'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2, Tablet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { provisionDevice } from './actions';

function DeviceProvisioningContent() {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);

    const code = searchParams.get('code');
    const role = (searchParams.get('role') ?? '').toLowerCase();
    const inviteLabel = searchParams.get('label');
    const targetModule =
        role === 'kitchen' || role === 'bar'
            ? '/kds/display'
            : role === 'waiter'
              ? '/waiter'
              : '/merchant';

    // Form State
    const [password, setPassword] = useState('');
    const [deviceName, setDeviceName] = useState(inviteLabel ?? '');

    useEffect(() => {
        if (!code) {
            toast.error('Invalid setup link');
            return;
        }
        // Ideally fetch invite details here purely for display
        // For now, we'll infer role from params if available or fetch via server action check
    }, [code]);

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!code) throw new Error('No setup code found');

            const result = await provisionDevice({
                code,
                password,
                deviceName: deviceName || `Device-${Math.floor(Math.random() * 1000)}`,
            });

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success('Device Provisioned Successfully!');
                window.location.replace(result.redirectTo);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Setup failed';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (!code) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <div className="space-y-4 text-center">
                    <h1 className="text-2xl font-bold text-red-600">Invalid Link</h1>
                    <p className="text-gray-500">This setup link is missing a code.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md space-y-8 rounded-xl border border-gray-100 bg-white p-8 shadow-xl">
                {/* Header */}
                <div className="space-y-2 text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-blue-50">
                        <Tablet className="h-8 w-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        Device Provisioning
                    </h1>
                    <p className="text-sm text-gray-500">
                        Configure this access key and install the assigned module.
                    </p>
                    <p className="text-xs font-semibold text-blue-700">Target: {targetModule}</p>
                </div>

                <form onSubmit={handleSetup} className="space-y-6">
                    <div className="space-y-4">
                        {/* Device Name Input */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Device Name
                            </label>
                            <Input
                                type="text"
                                placeholder="e.g. Kitchen Display 1, Waiter Phone"
                                value={deviceName}
                                onChange={e => setDeviceName(e.target.value)}
                                required
                                className="h-12"
                            />
                        </div>

                        {/* Password / Access Code */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Create Access PIN / Password
                            </label>
                            <Input
                                type="password"
                                placeholder="********"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="h-12"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                This will be used to unlock this device session.
                            </p>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="h-12 w-full bg-blue-600 text-base font-semibold hover:bg-blue-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Provisioning...
                            </>
                        ) : (
                            'Install & Connect'
                        )}
                    </Button>
                </form>

                <p className="text-center text-xs text-gray-400">
                    This device will be linked to your restaurant securely.
                </p>
            </div>
        </div>
    );
}

export default function DeviceProvisioningPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            }
        >
            <DeviceProvisioningContent />
        </Suspense>
    );
}
