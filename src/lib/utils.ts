import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const chunkText = (text: string, chunkSize = 1000): string[] =>
  Array.from({ length: Math.ceil(text.length / chunkSize) }, (_, index) =>
    text.slice(index * chunkSize, (index + 1) * chunkSize)
  );
