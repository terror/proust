import axios, { AxiosResponse } from 'axios';
import { toast } from 'sonner';

const OPENAI_COMPLETIONS_ENDPOINT =
  'https://api.openai.com/v1/chat/completions';

const OPENAI_EMBEDDINGS_ENDPOINT = 'https://api.openai.com/v1/embeddings';

type AskConfig = {
  context?: string;
  model: string;
  question?: string;
};

/**
 * Sends a question to the OpenAI API and returns the generated answer.
 *
 * @param {AskConfig} config - The configuration object for the API request.
 * @param {string} config.model - The GPT model to use (default: 'gpt-3.5-turbo').
 * @param {string} config.context - The context for the question (default: '').
 * @param {string} config.question - The question to ask (default: '').
 *
 * @returns {Promise<string | undefined>} The generated answer, or undefined if an error occurs.
 *
 * @throws {Error} If the API request fails.
 *
 * @example
 * const answer = await ask({
 *   model: 'gpt-3.5-turbo',
 *   context: 'The capital of France',
 *   question: 'What is the capital city?'
 * });
 */
export const ask = async (
  config: AskConfig = { model: 'gpt-3.5-turbo' }
): Promise<string | undefined> => {
  const time = performance.now();

  if (!config.question) {
    toast.error('Please provide a question');
    return;
  }

  try {
    const response = await axios.post(
      OPENAI_COMPLETIONS_ENDPOINT,
      {
        model: config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that answers questions based on the given context.',
          },
          {
            role: 'user',
            content: `Context: ${config.context}\n\nQuestion: ${config.question}\n\nAnswer:`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    toast.error(
      `Failed to ask question \`${error}\` in ${Math.round((performance.now() - time) / 1000)}s`
    );
  }
};

/**
 * Represents the structure of an individual embedding item in the OpenAI API response.
 */
interface EmbeddingItem {
  object: string;
  embedding: number[];
  index: number;
}

/**
 * Represents the structure of the OpenAI API response for embeddings.
 */
interface OpenAIEmbeddingResponse {
  object: string;
  data: EmbeddingItem[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generates embeddings for an array of texts using OpenAI's API.
 *
 * @param {string[]} texts - An array of strings to be embedded.
 *
 * @returns {Promise<number[][]>} A promise that resolves to an array of embedding vectors.
 *   Each vector is an array of numbers representing the embedding for the corresponding input text.
 *
 * @throws {Error} If the API request fails, an error is thrown and a toast notification is displayed.
 *
 * @example
 * const embeddings = await embed(['Hello world', 'OpenAI is amazing']);
 * console.log(embeddings); // [[0.1, 0.2, ...], [0.3, 0.4, ...]]
 */
export const embed = async (
  texts: string[]
): Promise<number[][] | undefined> => {
  const time = performance.now();

  try {
    const response: AxiosResponse<OpenAIEmbeddingResponse> = await axios.post(
      OPENAI_EMBEDDINGS_ENDPOINT,
      {
        input: texts,
        model: 'text-embedding-ada-002',
      },
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data.map((item: EmbeddingItem) => item.embedding);
  } catch (error: unknown) {
    toast.error(
      `Failed to embed text \`${error instanceof Error ? error.message : String(error)}\` in ${Math.round((performance.now() - time) / 1000)}s`
    );
  }
};
