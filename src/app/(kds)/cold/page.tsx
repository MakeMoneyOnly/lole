'use client';

import { StationBoard } from '@/features/kds/components/StationBoard';

export default function ColdPage(): React.JSX.Element {
    return (
        <StationBoard
            station="cold"
            title="Cold Station Display"
            accentClassName="bg-cyan-100 text-cyan-700"
        />
    );
}



