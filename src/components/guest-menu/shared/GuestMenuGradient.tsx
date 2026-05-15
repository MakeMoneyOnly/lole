import React from 'react';

export const GUEST_MENU_GRADIENT = 'linear-gradient(90deg, #DDF853 0%, #E6FB7A 100%)';

export const GuestMenuGradient: React.FC<{
    className?: string;
    children?: React.ReactNode;
}> = ({ className, children }) => {
    return (
        <div
            className={className}
            style={{
                background: GUEST_MENU_GRADIENT,
            }}
        >
            {children}
        </div>
    );
};
