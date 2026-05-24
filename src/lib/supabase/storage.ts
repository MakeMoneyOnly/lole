import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload an image to Supabase Storage
 * @param file - File to upload
 * @param bucket - Storage bucket name (default: 'food-images')
 * @param path - Optional path within bucket
 * @returns Public URL of uploaded image
 */
export async function uploadImage(
    file: File,
    bucket: string = 'food-images',
    path?: string
): Promise<string> {
    const fileName = path || `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
    });

    if (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const {
        data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return publicUrl;
}

/**
 * Get public URL for an image in storage
 * @param path - Path to image in storage
 * @param bucket - Storage bucket name (default: 'food-images')
 * @returns Public URL
 */
export function getImageUrl(path: string, bucket: string = 'food-images'): string {
    const {
        data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return publicUrl;
}

/**
 * Delete an image from storage
 * @param path - Path to image in storage
 * @param bucket - Storage bucket name (default: 'food-images')
 */
export async function deleteImage(path: string, bucket: string = 'food-images'): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
        throw new Error(`Failed to delete image: ${error.message}`);
    }
}
