import { getSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import type { StaffRole } from '@/types/status';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export interface UseRoleResult {
    role: StaffRole | null;
    loading: boolean;
    user: User | null;
    restaurantId: string | null;
    requireRole: (allowedRoles: StaffRole[], redirectUrl?: string) => void;
}

export function useRole(restaurantId: string | null): UseRoleResult {
    const [role, setRole] = useState<StaffRole | null>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [resolvedRestaurantId, setResolvedRestaurantId] = useState<string | null>(restaurantId);
    const router = useRouter();
    const supabase = useMemo(() => getSupabaseClient(), []);

    useEffect(() => {
        let cancelled = false;

        async function fetchRole(currentUser?: User | null): Promise<void> {
            if (!cancelled) {
                setLoading(true);
            }

            try {
                let activeUser = currentUser ?? null;
                if (!activeUser) {
                    const {
                        data: { user: authUser },
                        error: userError,
                    } = await supabase.auth.getUser();
                    if (userError || !authUser) {
                        if (cancelled) return;
                        setRole(null);
                        setUser(null);
                        setResolvedRestaurantId(null);
                        setLoading(false);
                        return;
                    }
                    activeUser = authUser;
                }

                if (!activeUser) {
                    if (cancelled) return;
                    setRole(null);
                    setUser(null);
                    setResolvedRestaurantId(null);
                    setLoading(false);
                    return;
                }

                if (cancelled) return;
                setUser(activeUser);

                // 2. Get Role (treat NULL is_active as active for compatibility with old rows)
                const baseQuery = supabase
                    .from('restaurant_staff')
                    .select('role, restaurant_id, is_active')
                    .eq('user_id', activeUser.id);

                const { data: roleFromRpc, error: rpcError } = await supabase.rpc(
                    'get_my_staff_role',
                    {
                        p_restaurant_id: restaurantId ?? undefined,
                    }
                );

                if (
                    !rpcError &&
                    roleFromRpc &&
                    (Array.isArray(roleFromRpc) ? roleFromRpc.length > 0 : roleFromRpc)
                ) {
                    const match = Array.isArray(roleFromRpc) ? roleFromRpc[0] : roleFromRpc;
                    if (cancelled) return;
                    setRole(match.role as StaffRole);
                    setResolvedRestaurantId(match.restaurant_id);
                    return;
                }

                const { data, error } = restaurantId
                    ? await baseQuery.eq('restaurant_id', restaurantId).maybeSingle()
                    : await baseQuery
                          .order('created_at', { ascending: false })
                          .limit(1)
                          .maybeSingle();

                if (error) {
                    if (cancelled) return;
                    logger.warn('Error fetching role', {
                        error: error.message,
                        source: '[features/auth/hooks/useRole]',
                    });
                    setRole(null);
                } else if (data && data.is_active !== false) {
                    if (cancelled) return;
                    setRole(data.role as StaffRole);
                    setResolvedRestaurantId(data.restaurant_id);
                } else {
                    if (cancelled) return;
                    setRole(null);
                    setResolvedRestaurantId(restaurantId);
                }
            } catch (err) {
                if (cancelled) return;
                logger.error('Error in useRole', err, { source: '[features/auth/hooks/useRole]' });
                setRole(null);
            } finally {
                if (cancelled) return;
                setLoading(false);
            }
        }

        fetchRole();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            void fetchRole(session?.user ?? null);
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, [restaurantId, supabase]);

    const requireRole = (allowedRoles: StaffRole[], redirectUrl = '/login'): void => {
        if (loading) return; // Don't redirect while loading
        if (!role || !allowedRoles.includes(role)) {
            router.push(redirectUrl);
        }
    };

    return { role, loading, user, restaurantId: resolvedRestaurantId, requireRole };
}
