import { z } from 'zod';

export const FoodItemSchema = z.object({
    id: z.string().uuid().or(z.string().min(1)),
    title: z.string().min(2).max(100),
    shop: z.string().min(2),
    price: z.number().positive(),
    imageUrl: z.string().url().or(z.string().startsWith('/')),
    category: z.string(),
    tag: z.string().optional(),
    rating: z.number().min(0).max(5),
});

export const CategorySchema = z.object({
    id: z.string(),
    name: z.string().min(2),
    icon: z.any().optional(),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;
export type Category = z.infer<typeof CategorySchema>;
