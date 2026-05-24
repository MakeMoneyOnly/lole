'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * The current page number (1-indexed)
     */
    currentPage: number;
    /**
     * Total number of pages
     */
    totalPages: number;
    /**
     * Callback when page changes
     */
    onPageChange: (page: number) => void;
    /**
     * Number of visible page buttons on each side of current page
     */
    siblingCount?: number;
    /**
     * Show first and last page buttons
     */
    showEdges?: boolean;
    /**
     * Text for previous button
     */
    previousLabel?: string;
    /**
     * Text for next button
     */
    nextLabel?: string;
}

const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
    (
        {
            className,
            currentPage,
            totalPages,
            onPageChange,
            siblingCount = 1,
            showEdges = true,
            previousLabel = 'Previous',
            nextLabel = 'Next',
            ...props
        },
        ref
    ) => {
        // Generate page numbers to display
        const getPageNumbers = (): (number | string)[] => {
            const pages: (number | string)[] = [];
            const totalNumbers = siblingCount * 2 + 3; // siblings + current + first/last + separators
            const _totalDots = 3;

            if (totalPages <= totalNumbers) {
                // If total pages is small, show all pages
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else if (currentPage <= siblingCount * 2 + 1) {
                // If current page is near the start
                for (let i = 1; i <= totalNumbers - 2; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - siblingCount * 2) {
                // If current page is near the end
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - totalNumbers + 2; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // If current page is in the middle
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - siblingCount; i <= currentPage + siblingCount; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }

            return pages;
        };

        const pageNumbers = getPageNumbers();

        const handlePrevious = (): void => {
            if (currentPage > 1) {
                onPageChange(currentPage - 1);
            }
        };

        const handleNext = (): void => {
            if (currentPage < totalPages) {
                onPageChange(currentPage + 1);
            }
        };

        return (
            <nav
                ref={ref}
                className={cn('flex items-center gap-1', className)}
                role="navigation"
                aria-label="Pagination"
                {...props}
            >
                {/* Previous Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    aria-label={previousLabel}
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{previousLabel}</span>
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                    {pageNumbers.map((page, index) => {
                        if (typeof page === 'string') {
                            // Render ellipsis
                            return (
                                <span
                                    key={`ellipsis-${index}`}
                                    className="flex h-8 w-8 items-center justify-center"
                                    aria-hidden="true"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </span>
                            );
                        }

                        const isActive = page === currentPage;
                        const _isFirst = showEdges && page === 1;
                        const _isLast = showEdges && page === totalPages;

                        // Skip first/last if edges are shown and they're already rendered as edges
                        if (showEdges && (index === 0 || index === pageNumbers.length - 1)) {
                            if (page === 1 && currentPage === 1) {
                                return (
                                    <Button
                                        key={page}
                                        variant={isActive ? 'primary' : 'ghost'}
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => onPageChange(page)}
                                        aria-current={isActive ? 'page' : undefined}
                                        aria-label={`Page ${page}`}
                                    >
                                        {page}
                                    </Button>
                                );
                            }
                            if (page === totalPages && currentPage === totalPages) {
                                return (
                                    <Button
                                        key={page}
                                        variant={isActive ? 'primary' : 'ghost'}
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => onPageChange(page)}
                                        aria-current={isActive ? 'page' : undefined}
                                        aria-label={`Page ${page}`}
                                    >
                                        {page}
                                    </Button>
                                );
                            }
                        }

                        return (
                            <Button
                                key={page}
                                variant={isActive ? 'primary' : 'ghost'}
                                size="sm"
                                className={cn('h-8 w-8 p-0', !isActive && 'hidden sm:flex')}
                                onClick={() => onPageChange(page)}
                                aria-current={isActive ? 'page' : undefined}
                                aria-label={`Page ${page}`}
                            >
                                {page}
                            </Button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    aria-label={nextLabel}
                >
                    <span className="hidden sm:inline">{nextLabel}</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </nav>
        );
    }
);

Pagination.displayName = 'Pagination';

interface PaginationInfoProps extends React.HTMLAttributes<HTMLDivElement> {
    currentPage: number;
    pageSize: number;
    totalItems: number;
}

const PaginationInfo = React.forwardRef<HTMLDivElement, PaginationInfoProps>(
    ({ className, currentPage, pageSize, totalItems, ...props }, ref) => {
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalItems);

        return (
            <div ref={ref} className={cn('text-sm text-black/60', className)} {...props}>
                Showing <span className="font-medium text-black">{startItem}</span> to{' '}
                <span className="font-medium text-black">{endItem}</span> of{' '}
                <span className="font-medium text-black">{totalItems}</span> results
            </div>
        );
    }
);

PaginationInfo.displayName = 'PaginationInfo';

export { Pagination, PaginationInfo };
