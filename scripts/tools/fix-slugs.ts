import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('.env.local');
const env = fs.readFileSync(envPath, 'utf8');

const parseEnv = (content: string) => {
    return content.split('\n').reduce(
        (acc: Record<string, string>, line: string) => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                acc[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
            }
            return acc;
        },
        {} as Record<string, string>
    );
};

const envVars = parseEnv(env);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SECRET_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('id, slug, name');

    if (error) {
        console.error('Error fetching restaurants:', error);
        return;
    }

    if (!restaurants || restaurants.length === 0) {
        console.warn('No restaurants found');
        return;
    }

    for (const restaurant of restaurants) {
        if (restaurant.slug && restaurant.slug.includes('-mltnetuf')) {
            const newSlug = restaurant.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-');

            console.log(`Updating ${restaurant.name}: ${restaurant.slug} -> ${newSlug}`);
            const { error: err } = await supabase
                .from('restaurants')
                .update({ slug: newSlug })
                .eq('id', restaurant.id);

            if (err) console.error('Error updating:', err);
            else console.warn('Successfully updated.');
        } else if (!restaurant.slug) {
            const newSlug = restaurant.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-');

            console.log(`Updating ${restaurant.name}: ${restaurant.slug} -> ${newSlug}`);
            const { error: err2 } = await supabase
                .from('restaurants')
                .update({ slug: newSlug })
                .eq('id', restaurant.id);

            if (err2) console.error('Error updating:', err2);
            else console.warn('Successfully updated.');
        } else {
            const newSlug = restaurant.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-');
            if (restaurant.slug !== newSlug) {
                console.warn(`Updating ${restaurant.name}: ${restaurant.slug} -> ${newSlug}`);
                const { error: err3 } = await supabase
                    .from('restaurants')
                    .update({ slug: newSlug })
                    .eq('id', restaurant.id);

                if (err3) console.error('Error updating:', err3);
                else console.warn('Successfully updated.');
            }
        }
    }
}

main();
