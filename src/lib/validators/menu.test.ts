/**
 * Menu Validator Tests
 *
 * Tests for src/lib/validators/menu.ts
 */

import { describe, it, expect } from 'vitest';
import {
    UpdatePriceSchema,
    UpdateAvailabilitySchema,
    CreateCategorySchema,
    UpdateCategorySchema,
    CreateMenuItemSchema,
} from '@/lib/validators/menu';

describe('menu validators', () => {
    describe('UpdatePriceSchema', () => {
        it('should validate valid price update', () => {
            const validInput = {
                itemId: '123e4567-e89b-12d3-a456-426614174000',
                price: 5000, // 50 ETB in santim
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdatePriceSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID for itemId', () => {
            const invalidInput = {
                itemId: 'not-a-uuid',
                price: 5000,
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdatePriceSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject zero price', () => {
            const invalidInput = {
                itemId: '123e4567-e89b-12d3-a456-426614174000',
                price: 0,
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdatePriceSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject negative price', () => {
            const invalidInput = {
                itemId: '123e4567-e89b-12d3-a456-426614174000',
                price: -5000,
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdatePriceSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject non-integer price', () => {
            const invalidInput = {
                itemId: '123e4567-e89b-12d3-a456-426614174000',
                price: 50.5,
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdatePriceSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject price exceeding max', () => {
            const invalidInput = {
                itemId: '123e4567-e89b-12d3-a456-426614174000',
                price: 100000000, // Too high
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdatePriceSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });

    describe('UpdateAvailabilitySchema', () => {
        it('should validate valid availability update', () => {
            const validInput = {
                itemId: '123e4567-e89b-12d3-a456-426614174000',
                is_available: true,
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdateAvailabilitySchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should reject non-boolean is_available', () => {
            const invalidInput = {
                itemId: '123e4567-e89b-12d3-a456-426614174000',
                is_available: 'true', // String instead of boolean
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdateAvailabilitySchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject invalid UUID for itemId', () => {
            const invalidInput = {
                itemId: 'invalid',
                is_available: true,
                restaurant_id: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = UpdateAvailabilitySchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });

    describe('CreateCategorySchema', () => {
        it('should validate valid category', () => {
            const validInput = {
                restaurant_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Main Dishes',
            };

            const result = CreateCategorySchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should accept optional name_am', () => {
            const validInput = {
                restaurant_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Main Dishes',
                name_am: 'ዋና ምግቦች',
            };

            const result = CreateCategorySchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should reject empty name', () => {
            const invalidInput = {
                restaurant_id: '123e4567-e89b-12d3-a456-426614174000',
                name: '',
            };

            const result = CreateCategorySchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject name exceeding 100 chars', () => {
            const invalidInput = {
                restaurant_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'a'.repeat(101),
            };

            const result = CreateCategorySchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should accept optional order_index', () => {
            const validInput = {
                restaurant_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Main Dishes',
                order_index: 5,
            };

            const result = CreateCategorySchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });
    });

    describe('UpdateCategorySchema', () => {
        it('should validate valid category update', () => {
            const validInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Updated Name',
            };

            const result = UpdateCategorySchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should accept all optional fields', () => {
            const validInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Updated Name',
                name_am: 'ተዘምኗ',
                order_index: 3,
            };

            const result = UpdateCategorySchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID for category_id', () => {
            const invalidInput = {
                category_id: 'not-a-uuid',
                name: 'Updated Name',
            };

            const result = UpdateCategorySchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });

    describe('CreateMenuItemSchema', () => {
        it('should validate valid menu item', () => {
            const validInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Coffee',
                price: 500, // 5 ETB in santim
            };

            const result = CreateMenuItemSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should accept all optional fields', () => {
            const validInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Coffee',
                name_am: 'ቡና',
                description: 'Freshly brewed coffee',
                description_am: 'አዲስ የተዘጋጀ ቡና',
                price: 500,
                is_available: true,
                is_fasting: false,
                is_chef_special: true,
                station: 'coffee' as const,
                ingredients: ['coffee beans', 'water', 'sugar'],
                allergens: ['caffeine'],
                preparation_time: 5,
                spicy_level: 0,
            };

            const result = CreateMenuItemSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should accept all station types', () => {
            const stations = ['kitchen', 'bar', 'dessert', 'coffee'] as const;

            stations.forEach(station => {
                const validInput = {
                    category_id: '123e4567-e89b-12d3-a456-426614174000',
                    name: 'Item',
                    price: 500,
                    station,
                };

                const result = CreateMenuItemSchema.safeParse(validInput);
                expect(result.success).toBe(true);
            });
        });

        it('should reject empty category_id', () => {
            const invalidInput = {
                category_id: '',
                name: 'Coffee',
                price: 500,
            };

            const result = CreateMenuItemSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject zero price', () => {
            const invalidInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Coffee',
                price: 0,
            };

            const result = CreateMenuItemSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject negative spicy_level', () => {
            const invalidInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Spicy Dish',
                price: 500,
                spicy_level: -1,
            };

            const result = CreateMenuItemSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject spicy_level > 5', () => {
            const invalidInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Very Spicy Dish',
                price: 500,
                spicy_level: 6,
            };

            const result = CreateMenuItemSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject preparation_time > 180', () => {
            const invalidInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Slow Dish',
                price: 500,
                preparation_time: 200,
            };

            const result = CreateMenuItemSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject too many ingredients', () => {
            const invalidInput = {
                category_id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Complex Dish',
                price: 500,
                ingredients: Array(51).fill('ingredient'),
            };

            const result = CreateMenuItemSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });
});
