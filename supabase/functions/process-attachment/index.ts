// supabase/functions/process-attachment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessAttachmentRequest {
  attachment_id: string;
}

interface ExtractedData {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  notes?: string;
  type?: 'walk' | 'run' | 'cycle' | 'strength' | 'yoga' | 'pilates' | 'swim' | 'crossfit' | 'hyrox' | 'horse' | 'other';
  duration_min?: number;
  distance_km?: number;
  intensity?: 'easy' | 'moderate' | 'hard';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { attachment_id }: ProcessAttachmentRequest = await req.json();
    
    if (!attachment_id) {
      throw new Error('attachment_id is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get attachment record
    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachment_id)
      .single();

    if (fetchError || !attachment) {
      throw new Error('Attachment not found');
    }

    // Update status to processing
    const { error: updateError } = await supabase
      .from('attachments')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', attachment_id);

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    // Process based on file type and category
    let extracted: ExtractedData = {};
    
    try {
      if (attachment.file_type === 'audio') {
        extracted = await processAudio(attachment, supabase);
      } else if (attachment.file_type === 'image') {
        extracted = await processImage(attachment, supabase);
      } else {
        throw new Error(`Unsupported file type: ${attachment.file_type}`);
      }

      // Update with successful results
      const { error: successError } = await supabase
        .from('attachments')
        .update({ 
          status: 'ready',
          extracted,
          updated_at: new Date().toISOString()
        })
        .eq('id', attachment_id);

      if (successError) {
        throw new Error(`Failed to save results: ${successError.message}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        extracted 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (processingError) {
      // Update with error status
      await supabase
        .from('attachments')
        .update({ 
          status: 'error',
          error_message: processingError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', attachment_id);

      throw processingError;
    }

  } catch (error) {
    console.error('Process attachment error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processAudio(attachment: any, supabase: any): Promise<ExtractedData> {
  console.log(`Processing audio file: ${attachment.file_name}`);
  
  // Mock implementation - replace with actual OpenAI calls
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    // Return mock data for development
    return generateMockData(attachment.category);
  }
  
  try {
    // TODO: Implement actual Whisper transcription
    // const transcription = await transcribeAudio(attachment.storage_path);
    
    // TODO: Implement GPT extraction
    // const extracted = await extractWithGPT(transcription, attachment.category);
    
    // For now, return mock data
    return generateMockData(attachment.category);
    
  } catch (error) {
    console.error('Audio processing error:', error);
    throw new Error('Failed to process audio file');
  }
}

async function processImage(attachment: any, supabase: any): Promise<ExtractedData> {
  console.log(`Processing image file: ${attachment.file_name}`);
  
  // Mock implementation - replace with actual OpenAI calls
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    // Return mock data for development
    return generateMockData(attachment.category);
  }
  
  try {
    // TODO: Implement actual Vision API
    // const description = await analyzeImage(attachment.storage_path);
    
    // TODO: Implement GPT extraction
    // const extracted = await extractWithGPT(description, attachment.category);
    
    // For now, return mock data
    return generateMockData(attachment.category);
    
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image file');
  }
}

function generateMockData(category: string): ExtractedData {
  // Generate realistic mock data based on category
  switch (category) {
    case 'nutrition':
      return {
        calories: Math.floor(Math.random() * 500) + 200,
        protein_g: Math.floor(Math.random() * 30) + 10,
        carbs_g: Math.floor(Math.random() * 50) + 20,
        fat_g: Math.floor(Math.random() * 20) + 5,
        notes: `Mock AI extracted nutrition data from ${category} upload`
      };
    
    case 'exercise':
      const types = ['walk', 'run', 'cycle', 'strength', 'yoga', 'pilates', 'swim', 'crossfit', 'hyrox', 'horse', 'other'];
      const intensities = ['easy', 'moderate', 'hard'];
      const selectedType = types[Math.floor(Math.random() * types.length)];
      
      return {
        type: selectedType as any,
        duration_min: Math.floor(Math.random() * 60) + 15,
        distance_km: ['walk', 'run', 'cycle'].includes(selectedType) ? Math.floor(Math.random() * 10) + 1 : undefined,
        intensity: intensities[Math.floor(Math.random() * intensities.length)] as any,
        notes: `Mock AI extracted exercise data from ${category} upload`
      };
    
    default:
      return {
        notes: `Mock AI processing completed for ${category} category`
      };
  }
}

// TODO: Implement actual OpenAI integration
async function transcribeAudio(storagePath: string): Promise<string> {
  // Implementation for Whisper API
  throw new Error('Whisper transcription not implemented yet');
}

async function analyzeImage(storagePath: string): Promise<string> {
  // Implementation for Vision API
  throw new Error('Image analysis not implemented yet');
}

async function extractWithGPT(content: string, category: string): Promise<ExtractedData> {
  // Implementation for GPT extraction
  throw new Error('GPT extraction not implemented yet');
}
