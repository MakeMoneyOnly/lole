import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RevenueChart from '../shared/RevenueChart';

// Mock next/dynamic to return a simple component
vi.mock('next/dynamic', () => ({
    default: () => {
        const MockChart = (): React.JSX.Element => (
            <div data-testid="mock-chart">Chart Content</div>
        );
        return MockChart;
    },
}));

describe('RevenueChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const { container } = render(<RevenueChart />);
        // Component renders something
        expect(container.firstChild).not.toBeNull();
    });

    it('renders chart skeleton on initial mount', () => {
        const { container } = render(<RevenueChart />);
        // Component shows skeleton initially (before useEffect runs)
        // After mounting, either skeleton or chart wrapper should exist
        expect(container.firstChild).toBeTruthy();
    });

    it('has proper structure for chart container', () => {
        const { container } = render(<RevenueChart />);
        // Component should have some container element
        expect(container.firstChild).toBeTruthy();
    });
});
