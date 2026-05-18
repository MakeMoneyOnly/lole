import React from 'react';
import { MenusPageClient } from '@/components/merchant/menus/MenusPageClient';
import { getMenuPageData } from '@/lib/services/dashboardDataService';

export default async function MenusPage() {
    const data = await getMenuPageData();
    return <MenusPageClient initialData={data} />;
}

