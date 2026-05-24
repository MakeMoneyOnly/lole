'use client';

import { StationBoard } from '@/features/kds/components/StationBoard';

export default function GrillPage(): React.JSX.Element {
    return (
        <StationBoard
            station="grill"
            title="Grill Display"
            accentClassName="bg-orange-100 text-orange-700"
        />
    );
}
