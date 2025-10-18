// src/hooks/useAttachmentStatus.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Attachment, AttachmentStatus } from '../lib/attachments';

interface UseAttachmentStatusReturn {
  status: AttachmentStatus;
  extracted: any;
  attachment: Attachment | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to monitor attachment processing status with polling
 * TODO: Replace with real-time subscription in future iteration
 */
export function useAttachmentStatus(id: string | null): UseAttachmentStatusReturn {
  const [status, setStatus] = useState<AttachmentStatus>('pending');
  const [extracted, setExtracted] = useState<any>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setStatus('pending');
      setExtracted(null);
      setAttachment(null);
      setError(null);
      return;
    }

    const pollAttachment = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('attachments')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Attachment not found');
            return;
          }
          throw fetchError;
        }

        if (data) {
          setStatus(data.status);
          setExtracted(data.extracted);
          setAttachment(data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch attachment status');
        console.error('Error polling attachment status:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial poll
    pollAttachment();

    // Set up polling interval
    const interval = setInterval(pollAttachment, 2000); // Poll every 2 seconds

    // Stop polling if status is final (ready or error)
    const stopPolling = () => {
      if (status === 'ready' || status === 'error') {
        clearInterval(interval);
      }
    };

    // Check if we should stop polling
    const currentStatus = status;
    if (currentStatus === 'ready' || currentStatus === 'error') {
      clearInterval(interval);
    } else {
      // Set up a timeout to stop polling after 5 minutes
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (status !== 'ready' && status !== 'error') {
          setError('Processing timeout - please try again');
        }
      }, 5 * 60 * 1000); // 5 minutes

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => {
      clearInterval(interval);
    };
  }, [id, status]);

  return {
    status,
    extracted,
    attachment,
    loading,
    error
  };
}
