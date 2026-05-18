type DbErrorLike = {
    code?: string | null;
    message?: string | null;
};

const SCHEMA_NOT_READY_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);

export function isSchemaNotReadyError(error: DbErrorLike | null | undefined) {
    if (!error) return false;
    if (error.code && SCHEMA_NOT_READY_CODES.has(error.code)) {
        return true;
    }

    const message = (error.message ?? '').toLowerCase();
    return (
        (message.includes('relation') && message.includes('does not exist')) ||
        (message.includes('column') && message.includes('does not exist'))
    );
}
