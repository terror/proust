import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjs, Document, Page } from 'react-pdf';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

import { File } from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModeToggle } from './components/mode-toggle';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';

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
                  items: item.items
                    ? await processOutline(item.items)
                    : undefined,
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
          <li key={index} className='my-1'>
            <button
              className='text-left hover:underline focus:outline-none'
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
    <ScrollArea className='h-[calc(100vh-200px)] w-64 p-4'>
      <h2 className='text-lg font-semibold mb-2'>Table of Contents</h2>
      {outline.length > 0 ? (
        renderTOCItems(outline)
      ) : (
        <p>No table of contents available</p>
      )}
    </ScrollArea>
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
  const [scale, setScale] = useState<number>(1);

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
      if (event.key === 'k') {
        setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
      } else if (event.key === 'j') {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      } else if (event.key === '+') {
        setScale((prev) => Math.min(prev + 0.1, 2)); // Increase scale, max 2x
      } else if (event.key === '-') {
        setScale((prev) => Math.max(prev - 0.1, 0.5)); // Decrease scale, min 0.5x
      } else if (event.key === '0') {
        setScale(1); // Reset to original size
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
        <PaginationItem key='ellipsis-start'>
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
        <PaginationItem key='ellipsis-end'>
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className='flex h-[calc(100vh-200px)]'>
      <div className='mr-4 mt-2'>
        <TableOfContents pdf={pdf} onItemClick={setCurrentPage} />
      </div>
      <div className='mt-2'>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              ref={setContainerRef}
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
              className='flex flex-col items-center'
            >
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                options={options}
              >
                <Page
                  pageNumber={currentPage}
                  width={
                    containerWidth
                      ? Math.min(containerWidth, maxWidth) * scale
                      : maxWidth * scale
                  }
                />
              </Document>
              {numPages && (
                <Pagination className='mt-4 mb-4'>
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
            <ContextMenuItem onClick={printSelectedText}>
              Contextualize Selection
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={nextPage}>
              Next Page
              <ContextMenuShortcut>k</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={prevPage}>
              Previous Page
              <ContextMenuShortcut>j</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
};

const Navbar = () => {
  return (
    <div className='flex justify-between items-center p-4'>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink className='text-xl font-semibold'>
              proust{' '}
              <p className='italic text-sm text-muted-foreground'>
                a learning tool
              </p>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <ModeToggle />
    </div>
  );
};

function CommandMenu({ onOpenFile }: { onOpenFile: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading='Suggestions'>
          <CommandItem
            onSelect={() => {
              onOpenFile();
              setOpen(false);
            }}
          >
            <File className='mr-2 h-4 w-4' />
            <span>Open</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

const App = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <Navbar />
      <main className='m-8 flex-grow flex items-center'>
        {file && <Viewer file={file} />}
      </main>
      <CommandMenu onOpenFile={() => fileInputRef.current?.click()} />
      <input
        ref={fileInputRef}
        type='file'
        accept='.pdf'
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default App;
