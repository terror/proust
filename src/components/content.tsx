import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useEffect, useState } from 'react';

import { ScrollArea } from './ui/scroll-area';

interface ContentItem {
  title: string;
  pageNumber: number;
  items?: ContentItem[];
}

interface ContentProps {
  pdf: PDFDocumentProxy | null;
  onItemClick: (pageNumber: number) => void;
}

export const Content: React.FC<ContentProps> = ({ pdf, onItemClick }) => {
  const [outline, setOutline] = useState<ContentItem[]>([]);

  useEffect(() => {
    const fetchOutline = async () => {
      if (!pdf) return;

      const outline = await pdf.getOutline();

      if (!outline) return;

      const processOutline = async (items: any[]): Promise<ContentItem[]> => {
        const processedItems = await Promise.all(
          items.map(async (item) => {
            let pageNumber = 1;

            if (item.dest) {
              const pageIndex = await pdf.getPageIndex(item.dest[0]);
              pageNumber = pageIndex + 1;
            }

            return {
              title: item.title,
              pageNumber,
              items: item.items ? await processOutline(item.items) : undefined,
            };
          })
        );

        return processedItems;
      };

      setOutline(await processOutline(outline));
    };

    fetchOutline();
  }, [pdf]);

  const render = (items: ContentItem[], depth = 0) => {
    return (
      <ul className={`pl-${depth * 4}`}>
        {items.map((item, index) => (
          <li key={index} className='my-1'>
            <button
              className='text-left hover:underline focus:outline-none'
              onClick={() => onItemClick(item.pageNumber)}
            >
              {item.title}
            </button>
            {item.items && render(item.items, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  if (outline.length === 0) return null;

  return (
    <ScrollArea className='h-[900px]'>
      <div className='p-4'>
        <h2 className='mb-2 text-lg font-semibold'>Table of Contents</h2>
        {render(outline)}
      </div>
    </ScrollArea>
  );
};
