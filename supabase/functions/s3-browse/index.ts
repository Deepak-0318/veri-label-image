import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from '@supabase/supabase-js'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/aws_s3';
const API_URL = 'https://connector-gateway.lovable.dev';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY is not configured. Please connect the AWS S3 connector first.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const AWS_S3_API_KEY = Deno.env.get('AWS_S3_API_KEY');
    if (!AWS_S3_API_KEY) {
      return new Response(JSON.stringify({ error: 'AWS_S3_API_KEY is not configured. Please connect the AWS S3 connector first.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, prefix, continuationToken, objectKey } = await req.json();

    if (action === 'list') {
      // List objects in bucket
      const params = new URLSearchParams({
        'list-type': '2',
        'delimiter': '/',
        'max-keys': '100',
      });
      if (prefix) params.set('prefix', prefix);
      if (continuationToken) params.set('continuation-token', continuationToken);

      const response = await fetch(`${GATEWAY_URL}/?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': AWS_S3_API_KEY,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`S3 list failed [${response.status}]: ${text}`);
      }

      const xml = await response.text();

      // Parse XML response
      const objects = parseListResponse(xml);

      return new Response(JSON.stringify(objects), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sign_download') {
      if (!objectKey) {
        return new Response(JSON.stringify({ error: 'objectKey is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const signResponse = await fetch(`${API_URL}/api/v1/sign_storage_url?provider=aws_s3&mode=read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': AWS_S3_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ object_path: objectKey }),
      });

      if (!signResponse.ok) {
        const text = await signResponse.text();
        throw new Error(`Sign URL failed [${signResponse.status}]: ${text}`);
      }

      const { url, expires_in } = await signResponse.json();
      return new Response(JSON.stringify({ url, expires_in }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('S3 browse error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseListResponse(xml: string) {
  const folders: Array<{ prefix: string; name: string }> = [];
  const files: Array<{ key: string; name: string; size: number; lastModified: string }> = [];
  let isTruncated = false;
  let nextToken: string | null = null;

  // Parse CommonPrefixes (folders)
  const prefixRegex = /<CommonPrefixes>\s*<Prefix>([^<]*)<\/Prefix>\s*<\/CommonPrefixes>/g;
  let match;
  while ((match = prefixRegex.exec(xml)) !== null) {
    const prefix = match[1];
    const name = prefix.replace(/\/$/, '').split('/').pop() || prefix;
    folders.push({ prefix, name });
  }

  // Parse Contents (files)
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  while ((match = contentsRegex.exec(xml)) !== null) {
    const content = match[1];
    const keyMatch = content.match(/<Key>([^<]*)<\/Key>/);
    const sizeMatch = content.match(/<Size>([^<]*)<\/Size>/);
    const dateMatch = content.match(/<LastModified>([^<]*)<\/LastModified>/);

    if (keyMatch) {
      const key = keyMatch[1];
      // Skip "directory" entries (keys that end with /)
      if (key.endsWith('/')) continue;
      const name = key.split('/').pop() || key;
      files.push({
        key,
        name,
        size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
        lastModified: dateMatch ? dateMatch[1] : '',
      });
    }
  }

  // Parse truncation info
  const truncMatch = xml.match(/<IsTruncated>([^<]*)<\/IsTruncated>/);
  if (truncMatch) isTruncated = truncMatch[1] === 'true';

  const tokenMatch = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
  if (tokenMatch) nextToken = tokenMatch[1];

  return { folders, files, isTruncated, nextToken };
}
