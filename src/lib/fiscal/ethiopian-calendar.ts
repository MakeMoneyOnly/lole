/**
 * Ethiopian Calendar Utility
 *
 * Ethiopian fiscal year runs Hamle 1 to Sene 30 (approximately July 8 to July 7).
 * Used for fiscal reporting periods required by MoR.
 */

const ETHIOPIAN_MONTHS_AM = [
    'መስከረም',
    'ጥቅምት',
    'ኅዳር',
    'ታኅሣሥ',
    'ጥር',
    'የካቲት',
    'መጋቢት',
    'ሚያዝያ',
    'ግንቦት',
    'ሰኔ',
    'ሐምሌ',
    'ነሐሴ',
    'ጳጉሜ',
];

const ETHIOPIAN_MONTHS_EN = [
    'Meskerem',
    'Tikimt',
    'Hidar',
    'Tahsas',
    'Tir',
    'Yekatit',
    'Megabit',
    'Miazia',
    'Ginbot',
    'Sene',
    'Hamle',
    'Nehase',
    'Pagume',
];

/**
 * Approximate Ethiopian date from Gregorian date.
 * Ethiopian year is ~7-8 years behind Gregorian.
 * This is a simplification — exact conversion requires astronomical calculations.
 */
export function gregorianToEthiopianApprox(date: Date): {
    year: number;
    month: number;
    monthAm: string;
    monthEn: string;
    day: number;
} {
    const ethNewYear = new Date(date.getFullYear(), 8, 11); // Sept 11

    let daysSinceNewYear: number;

    if (date >= ethNewYear) {
        daysSinceNewYear = Math.floor(
            (date.getTime() - ethNewYear.getTime()) / (1000 * 60 * 60 * 24)
        );
    } else {
        const prevNewYear = new Date(date.getFullYear() - 1, 8, 11);
        daysSinceNewYear = Math.floor(
            (date.getTime() - prevNewYear.getTime()) / (1000 * 60 * 60 * 24)
        );
    }

    const ethMonth = Math.min(12, Math.floor(daysSinceNewYear / 30));
    const ethDay = (daysSinceNewYear % 30) + 1;

    return {
        year: ethNewYear.getFullYear() - 8,
        month: ethMonth + 1,
        monthAm: ETHIOPIAN_MONTHS_AM[ethMonth],
        monthEn: ETHIOPIAN_MONTHS_EN[ethMonth],
        day: ethDay,
    };
}

/**
 * Get the start month index of the Ethiopian fiscal year.
 * Ethiopian fiscal year starts Hamle 1 (month index 10, 0-based).
 */
export function getFiscalYearStartMonth(): number {
    return 10; // Hamle
}

/**
 * Ethiopian fiscal year label for a Gregorian calendar year.
 */
export function ethiopianFiscalYearLabel(gregorianYear: number): string {
    const ethYear = gregorianYear - 8;
    return `${ethYear}/${ethYear + 1} (${ETHIOPIAN_MONTHS_EN[10]} 1 — ${ETHIOPIAN_MONTHS_EN[9]} 30)`;
}
