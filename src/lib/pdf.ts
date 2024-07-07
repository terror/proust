import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjs } from 'react-pdf';

export const extractText = async (
  arrayBuffer: ArrayBuffer
): Promise<string> => {
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + ' ';
  }

  return fullText;
};

export const fileToArrayBuffer = async (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export type OutlineItem = {
  title: string;
  pageNumber: number;
  items?: OutlineItem[];
};

export const parseOutline = async (
  pdf: PDFDocumentProxy
): Promise<OutlineItem[] | undefined> => {
  const outline = await pdf.getOutline();

  if (outline.length === 0) return undefined;

  const processOutlineItem = async (item: any): Promise<OutlineItem> => {
    const pageNumber = item.dest
      ? await pdf.getPageIndex(item.dest[0]).then((index) => index + 1)
      : 1;

    return {
      title: item.title,
      pageNumber,
      items: item.items
        ? await Promise.all(item.items.map(processOutlineItem))
        : undefined,
    };
  };

  return Promise.all(outline.map(processOutlineItem));
};
