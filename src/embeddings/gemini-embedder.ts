import https from 'https';

// gemini-embedding-001: 3072-dim, multilingual, supports Korean
// Uses v1beta REST API directly (SDK doesn't yet expose this model)
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_API_BASE = 'generativelanguage.googleapis.com';
const MAX_CHUNK_CHARS = 2000;
const BATCH_SIZE = 10; // conservative to avoid rate limits

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.\n' +
        '예: export GEMINI_API_KEY=your_api_key'
    );
  }
  return key;
}

/**
 * Call Gemini Embedding REST API directly.
 */
function fetchEmbedding(text: string, apiKey: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      content: { parts: [{ text }] },
    });

    const req = https.request(
      {
        hostname: EMBEDDING_API_BASE,
        path: `/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j.error) {
              reject(new Error(`Gemini API error: ${j.error.status} — ${j.error.message}`));
            } else {
              resolve(j.embedding.values as number[]);
            }
          } catch (e) {
            reject(new Error(`Failed to parse Gemini response: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Generate embedding for a single text string.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const truncated = text.slice(0, MAX_CHUNK_CHARS);
  return fetchEmbedding(truncated, apiKey);
}

/**
 * Generate embeddings for a batch of texts (with rate-limit friendly batching).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = getApiKey();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await Promise.all(
      batch.map((t) => fetchEmbedding(t.slice(0, MAX_CHUNK_CHARS), apiKey))
    );
    results.push(...embeddings);

    // Brief pause between batches to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

export const EMBEDDING_DIMENSION = 3072;
