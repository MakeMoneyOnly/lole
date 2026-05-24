import { AppLocale } from './locale';

type P2Copy = {
    finance: {
        title: string;
        subtitle: string;
        operationsCenter: string;
    };
    guests: {
        title: string;
        subtitle: string;
        growthTitle: string;
        growthSubtitle: string;
    };
};

const copy: Record<AppLocale, P2Copy> = {
    en: {
        finance: {
            title: 'Finance & Reconciliation',
            subtitle:
                'Settlement visibility, refund operations, payout matching, and accounting export.',
            operationsCenter: 'Finance Operations Center',
        },
        guests: {
            title: 'Guests',
            subtitle: 'CRM starter with profiles, tags, and visit history.',
            growthTitle: 'Revenue Growth Stack',
            growthSubtitle: 'Loyalty, gift cards, and campaign operations linked to guests.',
        },
    },
    am: {
        finance: {
            title: 'ፋይናንስ እና ማስታረቅ',
            subtitle: 'የመክፈያ ማጠቃለያ፣ የመመለሻ ሂደቶች፣ የክፍያ ማዛመድ እና የሂሳብ ኤክስፖርት።',
            operationsCenter: 'የፋይናንስ ኦፕርሴሽንስ ማዕከል',
        },
        guests: {
            title: 'እንግዶች',
            subtitle: 'የደንበኛ ፕሮፋይል፣ መለያዎች እና የጉብኝት ታሪክ መነሻ።',
            growthTitle: 'የገቢ እድገት ክፍል',
            growthSubtitle: 'ታማኝነት፣ የስጦታ ካርዶች እና የካምፔን ኦፕርሴሽኖች ከእንግዶች ጋር።',
        },
    },
};

export function getP2Copy(locale: AppLocale): P2Copy {
    return copy[locale];
}
