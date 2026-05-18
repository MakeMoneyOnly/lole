'use client';

import { StationBoard } from '@/features/kds/components/StationBoard';

export default function DessertPage(): React.JSX.Element {
    return (
        <StationBoard
            station="dessert"
            title="Dessert Display"
            accentClassName="bg-fuchsia-100 text-fuchsia-700"
        />
    );
}



