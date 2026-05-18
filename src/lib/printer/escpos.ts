export interface EscPosLineItem {
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string | null;
}

export interface EscPosTaxLine {
    label: string;
    amount: number;
}

export interface EscPosReceiptPayload {
    restaurant_name: string;
    restaurant_tin?: string | null;
    transaction_number: string;
    printed_at: string;
    order_label?: string | null;
    payment_label?: string | null;
    currency?: string;
    language?: 'en' | 'am';
    items: EscPosLineItem[];
    taxes?: EscPosTaxLine[];
    subtotal: number;
    total: number;
    footer_lines?: string[];
    fiscal_qr_payload?: string | null;
    fiscal_warning?: string | null;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function textBytes(input: string): number[] {
    return Array.from(new TextEncoder().encode(input));
}

function newline(text: string): number[] {
    return [...textBytes(text), LF];
}

function padRight(value: string, width: number): string {
    return value.length >= width ? value.slice(0, width) : value.padEnd(width, ' ');
}

function padLeft(value: string, width: number): string {
    return value.length >= width ? value.slice(0, width) : value.padStart(width, ' ');
}

function money(value: number, currency: string): string {
    return `Br ${value.toFixed(2)}`;
}

function qrStoreBytes(data: string): number[] {
    const payload = textBytes(data);
    const length = payload.length + 3;
    const pL = length % 256;
    const pH = Math.floor(length / 256);

    return [GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...payload];
}

function qrPrintBytes(): number[] {
    return [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30];
}

function qrSizeBytes(size: number): number[] {
    return [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(3, Math.min(12, size))];
}

function qrErrorCorrectionBytes(): number[] {
    return [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31];
}

async function encodeWithOptionalLibrary(
    payload: EscPosReceiptPayload
): Promise<Uint8Array | null> {
    try {
        interface ReceiptPrinterEncoderInstance {
            initialize: () => void;
            align: (alignment: string) => void;
            line: (text: string) => void;
            newline: () => void;
            bold: (enabled: boolean) => void;
            qrcode: (data: string) => void;
            cut: () => void;
            encode: () => Uint8Array;
        }
        interface EncoderModule {
            default?: new (options: { language: string }) => ReceiptPrinterEncoderInstance;
            ReceiptPrinterEncoder?: new (options: {
                language: string;
            }) => ReceiptPrinterEncoderInstance;
        }
        const importer = new Function('moduleName', 'return import(moduleName);') as (
            value: string
        ) => Promise<EncoderModule>;
        const encoderModule = await importer('@point-of-sale/receipt-printer-encoder');
        const ReceiptPrinterEncoder =
            encoderModule?.default ?? encoderModule?.ReceiptPrinterEncoder;
        if (!ReceiptPrinterEncoder) {
            return null;
        }

        const encoder = new ReceiptPrinterEncoder({
            language: 'esc-pos',
        });
        const isAmharic = payload.language === 'am';
        const labels = isAmharic
            ? {
                  tin: 'ቲን',
                  txn: 'የግብይት ቁጥር',
                  subtotal: 'ድምር ዋጋ',
                  total: 'ጠቅላላ ዋጋ',
                  payment: 'የክፍያ ዘዴ',
                  footer: 'ሎሌ ሬስቶራንት ኦኤስ',
              }
            : {
                  tin: 'TIN',
                  txn: 'Txn',
                  subtotal: 'Subtotal',
                  total: 'TOTAL',
                  payment: 'Payment',
                  footer: 'lole Restaurant OS',
              };

        encoder.initialize();
        encoder.align('center');
        encoder.line(payload.restaurant_name);

        if (payload.restaurant_tin) {
            encoder.line(`${labels.tin}: ${payload.restaurant_tin}`);
        }

        encoder.line(`${labels.txn}: ${payload.transaction_number}`);
        encoder.line(payload.printed_at);
        encoder.newline();
        encoder.align('left');

        payload.items.forEach(item => {
            encoder.line(
                `${item.quantity}x ${item.name} ${money(item.total_price, payload.currency ?? 'ETB')}`
            );
            if (item.notes) {
                encoder.line(`  ${item.notes}`);
            }
        });

        encoder.newline();
        encoder.line(`${labels.subtotal} ${money(payload.subtotal, payload.currency ?? 'ETB')}`);
        payload.taxes?.forEach(tax => {
            encoder.line(`${tax.label} ${money(tax.amount, payload.currency ?? 'ETB')}`);
        });
        encoder.bold(true);
        encoder.line(`${labels.total} ${money(payload.total, payload.currency ?? 'ETB')}`);
        encoder.bold(false);

        if (payload.fiscal_warning) {
            encoder.newline();
            encoder.line(payload.fiscal_warning);
        }

        if (payload.fiscal_qr_payload) {
            encoder.newline();
            encoder.qrcode(payload.fiscal_qr_payload);
        }

        payload.footer_lines?.forEach(line => encoder.line(line));
        encoder.line(labels.footer);
        encoder.newline();
        encoder.cut();
        return encoder.encode();
    } catch {
        return null;
    }
}

export async function encodeReceiptToEscPos(payload: EscPosReceiptPayload): Promise<Uint8Array> {
    const libraryResult = await encodeWithOptionalLibrary(payload);
    if (libraryResult) {
        return libraryResult;
    }

    const currency = payload.currency ?? 'ETB';
    const isAmharic = payload.language === 'am';
    const labels = isAmharic
        ? {
              tin: 'ቲን',
              txn: 'የግብይት ቁጥር',
              subtotal: 'ድምር ዋጋ',
              total: 'ጠቅላላ ዋጋ',
              payment: 'የክፍያ ዘዴ',
              separator: '─'.repeat(42),
              footer: 'ሎሌ ሬስቶራንት ኦኤስ',
          }
        : {
              tin: 'TIN',
              txn: 'Txn',
              subtotal: 'Subtotal',
              total: 'TOTAL',
              payment: 'Payment',
              separator: '-'.repeat(42),
              footer: 'lole Restaurant OS',
          };

    const bytes: number[] = [];
    bytes.push(ESC, 0x40);
    bytes.push(ESC, 0x61, 0x01);
    bytes.push(ESC, 0x45, 0x01, ...newline(payload.restaurant_name), ESC, 0x45, 0x00);

    if (payload.restaurant_tin) {
        bytes.push(...newline(`${labels.tin}: ${payload.restaurant_tin}`));
    }

    bytes.push(...newline(`${labels.txn}: ${payload.transaction_number}`));
    bytes.push(...newline(payload.printed_at));
    if (payload.order_label) {
        bytes.push(...newline(payload.order_label));
    }

    bytes.push(...newline(labels.separator));
    bytes.push(ESC, 0x61, 0x00);

    payload.items.forEach(item => {
        bytes.push(...newline(`${item.quantity}x ${item.name}`));
        bytes.push(
            ...newline(
                `${padRight(money(item.unit_price, currency), 20)}${padLeft(money(item.total_price, currency), 22)}`
            )
        );
        if (item.notes) {
            bytes.push(...newline(`  ${item.notes}`));
        }
    });

    bytes.push(...newline(labels.separator));
    bytes.push(
        ...newline(
            `${padRight(labels.subtotal, 20)}${padLeft(money(payload.subtotal, currency), 22)}`
        )
    );

    payload.taxes?.forEach(tax => {
        bytes.push(
            ...newline(`${padRight(tax.label, 20)}${padLeft(money(tax.amount, currency), 22)}`)
        );
    });

    bytes.push(ESC, 0x45, 0x01);
    bytes.push(
        ...newline(`${padRight(labels.total, 20)}${padLeft(money(payload.total, currency), 22)}`)
    );
    bytes.push(ESC, 0x45, 0x00);

    if (payload.payment_label) {
        bytes.push(...newline(`${labels.payment}: ${payload.payment_label}`));
    }

    if (payload.fiscal_warning) {
        bytes.push(LF, ...newline(payload.fiscal_warning));
    }

    if (payload.fiscal_qr_payload) {
        bytes.push(LF, ESC, 0x61, 0x01);
        bytes.push(...qrSizeBytes(6));
        bytes.push(...qrErrorCorrectionBytes());
        bytes.push(...qrStoreBytes(payload.fiscal_qr_payload));
        bytes.push(...qrPrintBytes(), LF);
        bytes.push(ESC, 0x61, 0x00);
    }

    payload.footer_lines?.forEach(line => {
        bytes.push(...newline(line));
    });

    bytes.push(LF, LF, LF, GS, 0x56, 0x41, 0x10);
    return Uint8Array.from(bytes);
}
