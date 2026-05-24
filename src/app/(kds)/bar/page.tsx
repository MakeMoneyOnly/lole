'use client';

import { StationBoard } from '@/features/kds/components/StationBoard';

export default function BarPage(): React.JSX.Element {
    return (
        <StationBoard
            station="bar"
            title="Bar Display"
            accentClassName="bg-blue-100 text-blue-700"
        />
    );
}
