import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjs, Document, Page } from 'react-pdf';
import { useCallback, useState, useEffect } from 'react';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { Label } from './components/ui/label';
import { Input } from './components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface TOCItem {
  title: string;
  pageNumber: number;
  items?: TOCItem[];
}

interface TOCProps {
  pdf: PDFDocumentProxy | null;
  onItemClick: (pageNumber: number) => void;
}

const TableOfContents: React.FC<TOCProps> = ({ pdf, onItemClick }) => {
  const [outline, setOutline] = useState<TOCItem[]>([]);

useEffect(() => {
    const fetchOutline = async () => {
      if (pdf) {
        const outline = await pdf.getOutline();
        if (outline) {
          const processOutline = async (items: any[]): Promise<TOCItem[]> => {
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

          const processedOutline = await processOutline(outline);
          setOutline(processedOutline);
        }
      }
    };

    fetchOutline();
  }, [pdf]);

  const renderTOCItems = (items: TOCItem[], depth = 0) => {
    return (
      <ul className={`pl-${depth * 4}`}>
        {items.map((item, index) => (
          <li key={index} className="my-1">
            <button
              className="text-left hover:underline focus:outline-none"
              onClick={() => onItemClick(item.pageNumber)}
            >
              {item.title}
            </button>
            {item.items && renderTOCItems(item.items, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="max-h-96 overflow-y-auto p-4 bg-white shadow-md rounded-md">
      <h2 className="text-lg font-semibold mb-2">Table of Contents</h2>
      {outline.length > 0 ? (
        renderTOCItems(outline)
      ) : (
        <p>No table of contents available</p>
      )}
    </div>
  );
};

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

const resizeObserverOptions = {};
const maxWidth = 800;

type PDFFile = string | File | null;

type ViewerProps = {
  file: PDFFile;
};

const Viewer = ({ file }: ViewerProps) => {
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [numPages, setNumPages] = useState<number>();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedText, setSelectedText] = useState<string>('');
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);

  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries;
    if (entry) {
      setContainerWidth(entry.contentRect.width);
    }
  }, []);

  useResizeObserver(containerRef, resizeObserverOptions, onResize);

  const onDocumentLoadSuccess = (pdf: PDFDocumentProxy): void => {
    setNumPages(pdf.numPages);
    setPdf(pdf);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'j') {
        setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
      } else if (event.key === 'k') {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [numPages]);

  const nextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
  };

  const prevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      setSelectedText(selection.toString());
    }
  };

  const printSelectedText = () => {
    console.log('Selected Text:', selectedText);
  };

const renderPaginationItems = () => {
    if (!numPages) return null;

    const items = [];
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let start = Math.max(1, currentPage - halfVisible);
    let end = Math.min(numPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    if (start > 1) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => setCurrentPage(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (end < numPages) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="flex">
      <div className="w-1/4 mr-4">
        <TableOfContents pdf={pdf} onItemClick={setCurrentPage} />
      </div>
      <div className="w-3/4">
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              ref={setContainerRef}
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
            >
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                options={options}
              >
                <Page
                  pageNumber={currentPage}
                  width={
                    containerWidth ? Math.min(containerWidth, maxWidth) : maxWidth
                  }
                />
              </Document>
              {numPages && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={prevPage} />
                    </PaginationItem>
                    {renderPaginationItems()}
                    <PaginationItem>
                      <PaginationNext onClick={nextPage} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={prevPage}>Previous Page</ContextMenuItem>
            <ContextMenuItem onClick={nextPage}>Next Page</ContextMenuItem>
            <ContextMenuItem onClick={printSelectedText}>Print Selected Text</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
};

const App = () => {
  const [file, setFile] = useState<PDFFile | undefined>(undefined);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { files } = event.target;
    const nextFile = files?.[0];
    if (nextFile) {
      setFile(nextFile);
    }
  };

  return (
    <div className='m-2'>
      <p>proust</p>
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="file">Open</Label>
        <Input onChange={onFileChange} accept='.pdf' id="file" type="file" />
      </div>
      {file && <Viewer file={file} />}
    </div>
  );
};

export default App;
