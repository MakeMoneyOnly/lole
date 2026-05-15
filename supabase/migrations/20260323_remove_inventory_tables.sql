-- Remove Inventory Feature
-- Date: 2026-03-23
-- Purpose: Remove inventory-related tables as feature has been discontinued

-- Drop inventory-related tables
DROP TABLE IF EXISTS public.recipe_ingredients CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.recipes CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.supplier_invoices CASCADE;

-- Verify remaining tables
SELECT 
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('inventory_items', 'recipes', 'recipe_ingredients', 'stock_movements', 'purchase_orders', 'supplier_invoices');