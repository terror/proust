import * as ai from './ai';
import { cosineSimilarity } from './math';

export type Workspace = {
  content: ArrayBuffer;
  lastOpened: string;
  name: string;
  notes: string;
  size: number;
};

type RelevantChunksInput = {
  question: string;
  topK: number;
  embeddings: number[][];
  chunks: string[];
};

type SimilarityItem = {
  index: number;
  similarity: number;
};

export const relevantChunks = async ({
  question,
  topK,
  embeddings,
  chunks,
}: RelevantChunksInput): Promise<string[]> => {
  if (embeddings.length === 0) return [];

  const questionEmbedding = await ai.embed([question]);

  if (!questionEmbedding || questionEmbedding.length === 0) return [];

  const similarities: SimilarityItem[] = embeddings.map((emb, i) => ({
    index: i,
    similarity: cosineSimilarity(questionEmbedding[0], emb),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topK).map((item) => chunks[item.index]);
};
