import type { PDFDocumentProxy } from 'pdfjs-dist';

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
