-- Add trigger to keep tables status in sync with orders
BEGIN;

-- Ensure tables and orders are in publication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tables') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tables;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_table_status_on_order()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('pending', 'acknowledged', 'preparing', 'ready', 'served') THEN
       UPDATE public.tables 
       SET status = 'occupied', active_order_id = NEW.id 
       WHERE table_number = NEW.table_number AND restaurant_id = NEW.restaurant_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
       -- Check if there are other active orders for this table
       IF NOT EXISTS (
           SELECT 1 FROM public.orders 
           WHERE table_number = NEW.table_number 
             AND restaurant_id = NEW.restaurant_id 
             AND id != NEW.id 
             AND status NOT IN ('completed', 'cancelled')
       ) THEN
           UPDATE public.tables 
           SET status = 'available', active_order_id = NULL 
           WHERE table_number = NEW.table_number AND restaurant_id = NEW.restaurant_id;
       END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trg_update_table_status ON public.orders;

-- Create trigger
CREATE TRIGGER trg_update_table_status
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_table_status_on_order();

COMMIT;
