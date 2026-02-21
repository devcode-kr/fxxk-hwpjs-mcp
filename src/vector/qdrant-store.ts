import { QdrantClient } from '@qdrant/js-client-rest';
import { EMBEDDING_DIMENSION } from '../embeddings/gemini-embedder.js';
import type { DocumentId } from '../types.js';

// Collection name in Qdrant
const COLLECTION_NAME = 'hwp_spec';

let _client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!_client) {
    const url = process.env.QDRANT_URL ?? 'http://localhost:6333';
    _client = new QdrantClient({ url });
  }
  return _client;
}

// -------------------------------------------------------------------
// Payload stored alongside each vector
// -------------------------------------------------------------------

export interface ChunkPayload {
  docId: DocumentId;
  page: number;
  sectionId?: string;
  sectionTitle?: string;
  text: string;
}

// -------------------------------------------------------------------
// Collection management
// -------------------------------------------------------------------

export async function ensureCollection(): Promise<void> {
  const client = getClient();

  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (!exists) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIMENSION,
        distance: 'Cosine',
      },
    });
    console.error(`[qdrant] Collection '${COLLECTION_NAME}' created.`);
  }
}

export async function collectionExists(): Promise<boolean> {
  const client = getClient();
  const collections = await client.getCollections();
  return collections.collections.some((c) => c.name === COLLECTION_NAME);
}

// -------------------------------------------------------------------
// Check if a document is already indexed
// -------------------------------------------------------------------

export async function isDocIndexed(docId: DocumentId): Promise<boolean> {
  const client = getClient();
  try {
    const result = await client.scroll(COLLECTION_NAME, {
      filter: { must: [{ key: 'docId', match: { value: docId } }] },
      limit: 1,
      with_payload: false,
      with_vector: false,
    });
    return result.points.length > 0;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------
// Upsert (add or overwrite) chunks for a document
// -------------------------------------------------------------------

export async function upsertChunks(
  docId: DocumentId,
  chunks: Array<{ text: string; embedding: number[]; payload: Omit<ChunkPayload, 'docId' | 'text'> }>
): Promise<void> {
  const client = getClient();

  // Remove existing points for this document first
  await client.delete(COLLECTION_NAME, {
    filter: { must: [{ key: 'docId', match: { value: docId } }] },
  });

  // Insert in batches of 100
  const BATCH = 100;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points: batch.map((chunk, j) => ({
        id: i + j + Math.floor(Math.random() * 1_000_000), // simple unique id
        vector: chunk.embedding,
        payload: {
          docId,
          text: chunk.text,
          page: chunk.payload.page,
          sectionId: chunk.payload.sectionId ?? null,
          sectionTitle: chunk.payload.sectionTitle ?? null,
        },
      })),
    });
  }

  console.error(`[qdrant] Upserted ${chunks.length} chunks for '${docId}'.`);
}

// -------------------------------------------------------------------
// Semantic search
// -------------------------------------------------------------------

export interface SearchHit {
  docId: DocumentId;
  page: number;
  sectionId?: string;
  sectionTitle?: string;
  text: string;
  score: number;
}

export async function semanticSearch(
  queryEmbedding: number[],
  options: {
    docId?: DocumentId;
    limit?: number;
    scoreThreshold?: number;
  } = {}
): Promise<SearchHit[]> {
  const client = getClient();
  const { docId, limit = 10, scoreThreshold = 0.5 } = options;

  const filter = docId
    ? { must: [{ key: 'docId', match: { value: docId } }] }
    : undefined;

  const results = await client.search(COLLECTION_NAME, {
    vector: queryEmbedding,
    limit,
    score_threshold: scoreThreshold,
    filter,
    with_payload: true,
  });

  return results.map((hit) => ({
    docId: hit.payload!.docId as DocumentId,
    page: hit.payload!.page as number,
    sectionId: hit.payload!.sectionId as string | undefined,
    sectionTitle: hit.payload!.sectionTitle as string | undefined,
    text: hit.payload!.text as string,
    score: hit.score,
  }));
}
