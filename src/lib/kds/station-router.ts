export type RoutedStation =
    | 'kitchen'
    | 'bar'
    | 'dessert'
    | 'coffee'
    | 'grill'
    | 'cold'
    | 'expeditor';

export interface StationRouterInput {
    itemName?: string | null;
    station?: string | null;
    connectedStations?: string[] | null;
    categoryName?: string | null;
    course?: string | null;
}

const STATION_KEYWORDS: Array<{ station: RoutedStation; keywords: string[] }> = [
    { station: 'expeditor', keywords: ['expeditor', 'expo', 'pass'] },
    { station: 'coffee', keywords: ['coffee', 'espresso', 'latte', 'cappuccino', 'barista'] },
    { station: 'bar', keywords: ['bar', 'cocktail', 'beer', 'wine', 'juice', 'smoothie'] },
    { station: 'dessert', keywords: ['dessert', 'cake', 'pastry', 'ice cream', 'sweet'] },
    { station: 'cold', keywords: ['cold', 'salad', 'mezze', 'appetizer'] },
    { station: 'grill', keywords: ['grill', 'bbq', 'tibs', 'roast', 'skewer'] },
];

function normalizeStation(value: string | null | undefined): RoutedStation | null {
    if (!value) {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (
        normalized === 'kitchen' ||
        normalized === 'bar' ||
        normalized === 'dessert' ||
        normalized === 'coffee' ||
        normalized === 'grill' ||
        normalized === 'cold' ||
        normalized === 'expeditor'
    ) {
        return normalized;
    }

    return null;
}

function detectKeywordStation(input: StationRouterInput): RoutedStation | null {
    const haystack = [input.itemName, input.categoryName, input.course]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' ')
        .toLowerCase();

    if (!haystack) {
        return null;
    }

    for (const candidate of STATION_KEYWORDS) {
        if (
            candidate.keywords.some(keyword =>
                new RegExp(`(^|[^a-z])${keyword.replace(/ /g, '\\s+')}([^a-z]|$)`).test(haystack)
            )
        ) {
            return candidate.station;
        }
    }

    return null;
}

export function routeOrderItemToStations(input: StationRouterInput): RoutedStation[] {
    const explicitStations = (input.connectedStations ?? [])
        .map(normalizeStation)
        .filter((station): station is RoutedStation => station !== null);

    if (explicitStations.length > 0) {
        return [...new Set(explicitStations)];
    }

    const explicitPrimary = normalizeStation(input.station);
    if (explicitPrimary) {
        return [explicitPrimary];
    }

    const keywordMatch = detectKeywordStation(input);
    if (keywordMatch) {
        return [keywordMatch];
    }

    return ['kitchen'];
}

export function routeOrderItemToPrimaryStation(input: StationRouterInput): RoutedStation {
    const stations = routeOrderItemToStations(input);
    return stations.find(station => station !== 'expeditor') ?? stations[0] ?? 'kitchen';
}
