'use client';

interface BroadcastInputProps {
    value: string;
    onChange: (value: string) => void;
    onBroadcast: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
}

export function BroadcastInput({ value, onChange, onBroadcast, onKeyDown }: BroadcastInputProps): React.JSX.Element {
    return (
        <div className="relative mt-auto bg-white pt-6">
            <div className="group relative">
                <input
                    type="text"
                    placeholder="Type a quick broadcast to staff..."
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="w-full rounded-xl bg-[#F8F9FA] py-4 pr-12 pl-6 text-sm font-medium shadow-inner transition-all placeholder:text-gray-400 focus:ring-0 focus:outline-none"
                />

                <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-3 text-gray-400">
                    <button
                        onClick={onBroadcast}
                        className="transition-transform hover:scale-110 hover:text-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!value.trim()}
                    >
                        <span
                            role="img"
                            aria-label="emoji"
                            className="text-2xl shadow-none contrast-125 filter transition-all hover:brightness-110"
                        >
                            📢
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
