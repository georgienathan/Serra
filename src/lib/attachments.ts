// src/lib/attachments.ts
import { supabase } from './supabase';
import Constants from 'expo-constants';

type Extra = { supabaseUrl?: string; supabaseAnonKey?: string; storageBucket?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export type AttachmentCategory = 'nutrition' | 'exercise' | 'period' | 'sleep';
export type AttachmentFileType = 'image' | 'audio';
export type AttachmentStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface Attachment {
  id: string;
  user_id: string;
  category: AttachmentCategory;
  day: string; // YYYY-MM-DD
  file_name: string;
  file_type: AttachmentFileType;
  file_size: number;
  storage_path: string;
  status: AttachmentStatus;
  extracted?: any;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface UploadParams {
  category: AttachmentCategory;
  day: string;
  localUri: string;
  fileType: AttachmentFileType;
  fileName?: string;
}

/**
 * Upload a file and create an attachment record
 */
export async function uploadAndProcess({
  category,
  day,
  localUri,
  fileType,
  fileName
}: UploadParams): Promise<Attachment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Generate unique filename if not provided
  const uuid = crypto.randomUUID();
  const extension = fileType === 'image' ? 'jpg' : 'm4a';
  const finalFileName = fileName || `${uuid}.${extension}`;
  const storagePath = `uploads/user/${user.id}/${day}/${finalFileName}`;

  try {
    // Read file data
    const response = await fetch(localUri);
    const blob = await response.blob();

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from(extra.storageBucket || 'uploads')
      .upload(storagePath, blob, {
        contentType: fileType === 'image' ? 'image/jpeg' : 'audio/m4a',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Create attachment record
    const { data: attachment, error: insertError } = await supabase
      .from('attachments')
      .insert({
        user_id: user.id,
        category,
        day,
        file_name: finalFileName,
        file_type: fileType,
        file_size: blob.size,
        storage_path: storagePath,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    // Trigger processing (call Edge Function)
    const { error: processError } = await supabase.functions.invoke('process-attachment', {
      body: { attachment_id: attachment.id }
    });

    if (processError) {
      console.warn('Failed to trigger processing:', processError.message);
      // Don't throw here - the attachment was created successfully
    }

    return attachment;
  } catch (error) {
    // Clean up uploaded file if database insert failed
    try {
      await supabase.storage
        .from(extra.storageBucket || 'uploads')
        .remove([storagePath]);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError);
    }
    
    throw error;
  }
}

/**
 * Get attachment by ID
 */
export async function getAttachment(id: string): Promise<Attachment | null> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Get attachments for a specific day and category
 */
export async function getAttachmentsForDay(
  day: string, 
  category: AttachmentCategory
): Promise<Attachment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('user_id', user.id)
    .eq('day', day)
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Delete attachment and associated file
 */
export async function deleteAttachment(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get attachment to find storage path
  const attachment = await getAttachment(id);
  if (!attachment || attachment.user_id !== user.id) {
    throw new Error('Attachment not found or access denied');
  }

  // Delete from database first
  const { error: dbError } = await supabase
    .from('attachments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (dbError) throw dbError;

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(extra.storageBucket || 'uploads')
    .remove([attachment.storage_path]);

  if (storageError) {
    console.warn('Failed to delete file from storage:', storageError.message);
    // Don't throw - database record was deleted successfully
  }
}

/**
 * Get public URL for attachment file
 */
export function getAttachmentUrl(attachment: Attachment): string {
  const { data } = supabase.storage
    .from(extra.storageBucket || 'uploads')
    .getPublicUrl(attachment.storage_path);

  return data.publicUrl;
}
