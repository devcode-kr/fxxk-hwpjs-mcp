import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini text-embedding-004: 768-dim, multilingual, supports Korean
const EMBEDDING_MODEL = 'text-embedding-004';
const MAX_CHUNK_CHARS = 2000;
const BATCH_SIZE = 20; // Gemini API batch limit

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.\n' +
          '예: export GEMINI_API_KEY=your_api_key'
      );
    }
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

/**
 * Generate embedding for a single text string.
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  const truncated = text.slice(0, MAX_CHUNK_CHARS);
  const result = await model.embedContent(truncated);
  return result.embedding.values;
}

/**
 * Generate embeddings for a batch of texts (with rate-limit friendly batching).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await Promise.all(batch.map((t) => embedText(t)));
    results.push(...embeddings);

    // Brief pause between batches to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

export const EMBEDDING_DIMENSION = 768;
