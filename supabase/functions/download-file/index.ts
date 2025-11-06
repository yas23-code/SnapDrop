import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    const pasteKey = url.searchParams.get('key');

    if (!fileId || !pasteKey) {
      return new Response(
        JSON.stringify({ error: 'Missing fileId or key parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key for storage access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get file info and check if it should be deleted (atomic operation)
    const { data: fileInfo, error: rpcError } = await supabase.rpc('get_file_for_download', {
      file_id_param: fileId,
      paste_key_param: pasteKey,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch file info' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fileInfo || fileInfo.length === 0) {
      return new Response(
        JSON.stringify({ error: 'File not found or already deleted' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const file = fileInfo[0];

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('paste-files')
      .download(file.storage_path);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If should_delete is true, delete the file and metadata
    if (file.should_delete) {
      console.log('Deleting file after first view:', fileId);
      
      // Delete from storage
      await supabase.storage.from('paste-files').remove([file.storage_path]);
      
      // Delete metadata
      await supabase.from('paste_files').delete().eq('id', fileId);
      
      // Also delete the paste
      await supabase.from('pastes').delete().eq('key', pasteKey);
    }

    // Return the file with appropriate headers
    const blob = await fileData.arrayBuffer();
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': file.file_type,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error in download-file function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
