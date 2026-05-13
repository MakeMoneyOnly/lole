import { apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser } from '@/lib/api/authz';

const ARTICLES = [
    {
        id: 'article-order-lifecycle',
        title: 'Managing order lifecycle in Service Ops',
        category: 'Orders',
    },
    {
        id: 'article-qr-regeneration',
        title: 'Regenerating signed table QR codes',
        category: 'Tables',
    },
    {
        id: 'article-staff-roles',
        title: 'Understanding staff roles and permissions',
        category: 'Staff',
    },
    {
        id: 'article-analytics-basics',
        title: 'Reading command center analytics',
        category: 'Analytics',
    },
];

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const query = new URL(request.url).searchParams.get('query')?.trim().toLowerCase() ?? '';
    const filtered =
        query.length === 0
            ? ARTICLES
            : ARTICLES.filter(
                  article =>
                      article.title.toLowerCase().includes(query) ||
                      article.category.toLowerCase().includes(query)
              );

    return apiSuccess({ articles: filtered });
}
