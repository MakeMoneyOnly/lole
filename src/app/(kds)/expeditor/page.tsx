'use client';

import { ExpeditorBoard } from '@/features/kds/components/ExpeditorBoard';
import { RoleGuard } from '@/components/auth/guards/RoleGuard';

export default function ExpeditorPage(): React.JSX.Element {
    return (
        <RoleGuard allowedRoles={['owner', 'admin', 'manager']}>
            <ExpeditorBoard />
        </RoleGuard>
    );
}



