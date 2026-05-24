import React from 'react';
import { HelpSupportPageClient } from '@/components/merchant/help-support/HelpSupportPageClient';

export default function HelpSupportPage(): React.JSX.Element {
    return <HelpSupportPageClient initialArticles={[]} initialTickets={[]} />;
}
