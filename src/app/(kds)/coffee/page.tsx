'use client';

import { StationBoard } from '@/features/kds/components/StationBoard';

export default function CoffeePage(): React.JSX.Element {
    return (
        <StationBoard
            station="coffee"
            title="Coffee Display"
            accentClassName="bg-amber-100 text-amber-800"
        />
    );
}
