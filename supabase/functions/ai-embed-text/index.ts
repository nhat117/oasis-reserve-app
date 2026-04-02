import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { aiEmbedTextSchema, parseBody } from "../_shared/validation.ts";

/**
 * Generate vector embeddings for a knowledge base article.
 *
 * Chunks text into ~500-token segments with overlap, calls the
 * configured embedding model (OpenAI-compatible), and upserts
 * into knowledge_base_embeddings.
 *
 * POST body: { text, knowledge_base_id, tenant_id }
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const parsed = parseBody(aiEmbedTextSchema, body, corsHeaders);
    if (parsed.response) return parsed.response;

    const { text, knowledge_base_id, tenant_id } = parsed.data;

    // Load AI config for the tenant
    const { data: config } = await supabase
      .from("ai_config")
      .select("api_base_url, api_key_encrypted, embedding_model")
      .eq("tenant_id", tenant_id)
      .single();

    if (!config?.api_key_encrypted) {
      return new Response(
        JSON.stringify({ error: "AI not configured for this tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    const apiKey = encryptionKey
      ? await decryptToken(config.api_key_encrypted, encryptionKey)
      : config.api_key_encrypted;

    const baseUrl = config.api_base_url || "https://api.openai.com/v1";
    const embeddingModel = config.embedding_model || "text-embedding-3-small";

    // Chunk text
    const chunks = chunkText(text, 500, 50);

    // Delete existing embeddings for this article
    await supabase
      .from("knowledge_base_embeddings")
      .delete()
      .eq("knowledge_base_id", knowledge_base_id)
      .eq("tenant_id", tenant_id);

    // Generate embeddings for each chunk
    const embeddings = await generateEmbeddings(chunks, baseUrl, apiKey, embeddingModel);

    // Insert new embeddings
    const rows = chunks.map((chunk, index) => ({
      tenant_id,
      knowledge_base_id,
      chunk_index: index,
      chunk_text: chunk,
      embedding: JSON.stringify(embeddings[index]),
    }));

    const { error: insertErr } = await supabase
      .from("knowledge_base_embeddings")
      .insert(rows);

    if (insertErr) {
      console.error("Failed to insert embeddings:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to store embeddings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, chunks_count: chunks.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Embed text error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Chunk text into segments of approximately `maxTokens` tokens
 * with `overlapTokens` overlap. Uses word boundaries.
 */
function chunkText(text: string, maxTokens: number, overlapTokens: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  // Approximate: 1 token ≈ 0.75 words
  const wordsPerChunk = Math.floor(maxTokens * 0.75);
  const overlapWords = Math.floor(overlapTokens * 0.75);

  if (words.length <= wordsPerChunk) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(" "));
    start = end - overlapWords;
    if (start >= words.length - overlapWords) {
      // Avoid a tiny trailing chunk
      break;
    }
  }

  // Ensure we capture the tail
  if (start < words.length && start > 0) {
    const tail = words.slice(start).join(" ");
    if (tail !== chunks[chunks.length - 1]) {
      chunks.push(tail);
    }
  }

  return chunks;
}

/**
 * Call OpenAI-compatible embeddings endpoint.
 */
async function generateEmbeddings(
  texts: string[],
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<number[][]> {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  // Sort by index to ensure correct order
  const sorted = data.data.sort((a: { index: number }, b: { index: number }) => a.index - b.index);
  return sorted.map((item: { embedding: number[] }) => item.embedding);
}

async function decryptToken(encryptedHex: string, keyHex: string): Promise<string> {
  try {
    const encBytes = hexToBytes(encryptedHex);
    const iv = encBytes.slice(0, 12);
    const ciphertext = encBytes.slice(12);
    const keyBytes = hexToBytes(keyHex);
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedHex;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
