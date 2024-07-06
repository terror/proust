import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjs, Document, Page } from 'react-pdf';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

import { File as FileIcon, BookText } from 'lucide-react';

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
import { Button } from './components/ui/button';
import { toast } from 'sonner';

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

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>();
  const [selectedText, setSelectedText] = useState<string>('');
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
      if (event.key === 'k')
        setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
      else if (event.key === 'j')
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      else if (event.key === '+') setScale((prev) => Math.min(prev + 0.1, 2));
      else if (event.key === '-') setScale((prev) => Math.max(prev - 0.1, 0.5));
      else if (event.key === '0') setScale(1);
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
            <FileIcon className='mr-2 h-4 w-4' />
            <span>Open</span>
          </CommandItem>
          <CommandItem>
            <BookText className='mr-2 h-4 w-4' />
            <span>Workspaces</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

interface PDFHistory {
  name: string;
  lastOpened: string;
  size: number;
}

import { openDB, IDBPDatabase } from 'idb';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfHistory, setPdfHistory] = useState<PDFHistory[]>([]);
  const [db, setDb] = useState<IDBPDatabase | null>(null);

  useEffect(() => {
    const initDB = async () => {
      const database = await openDB('PDFStorage', 1, {
        upgrade(db) {
          db.createObjectStore('pdfs');
        },
      });
      setDb(database);
    };

    initDB();
  }, []);

  useEffect(() => {
    const storedHistory = localStorage.getItem('pdfHistory');
    if (storedHistory) {
      setPdfHistory(JSON.parse(storedHistory));
    }
  }, []);

  useEffect(() => {
    // Cleanup function to revoke object URLs
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const saveToLocalStorage = useCallback((history: PDFHistory[]) => {
    localStorage.setItem('pdfHistory', JSON.stringify(history));
  }, []);

  const processPDF = async (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const onFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && db) {
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
        return;
      }

      try {
        const arrayBuffer = await processPDF(selectedFile);
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setFileUrl(url);

        // Store PDF in IndexedDB
        await db.put('pdfs', arrayBuffer, selectedFile.name);

        const newHistory = [
          {
            name: selectedFile.name,
            lastOpened: new Date().toISOString(),
            size: selectedFile.size,
          },
          ...pdfHistory.filter((item) => item.name !== selectedFile.name),
        ].slice(0, 10);

        setPdfHistory(newHistory);
        saveToLocalStorage(newHistory);
      } catch (error) {
        console.error('Error processing file:', error);
        toast('Failed to process the PDF file. Please try again.');
      }
    }
  }, [db, pdfHistory, saveToLocalStorage]);

  const openHistoryFile = useCallback(async (historyItem: PDFHistory) => {
    if (db) {
      try {
        const arrayBuffer = await db.get('pdfs', historyItem.name);
        if (arrayBuffer) {
          const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setFileUrl(url);

          const updatedHistory = pdfHistory.map((item) =>
            item.name === historyItem.name
              ? { ...item, lastOpened: new Date().toISOString() }
              : item
          );
          setPdfHistory(updatedHistory);
          saveToLocalStorage(updatedHistory);
        } else {
          toast(`File "${historyItem.name}" not found in storage. Please open it again.`);
        }
      } catch (error) {
        console.error('Error opening file from history:', error);
        toast('Failed to open the PDF file. Please try again.');
      }
    }
  }, [db, pdfHistory, saveToLocalStorage]);

  return (
    <div className='m-2'>
      <Navbar />
      <main className='m-8 flex-grow flex items-center'>
        {fileUrl && <Viewer file={fileUrl} />}
      </main>
      <CommandMenu onOpenFile={() => fileInputRef.current?.click()} />
      <input
        ref={fileInputRef}
        type='file'
        accept='.pdf'
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
      <Sheet>
        <SheetTrigger asChild>
          <Button variant='outline' className='fixed bottom-4 right-4'>
            Workspaces
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Workspaces</SheetTitle>
            <SheetDescription>
              Your recently opened PDFs. Click on one to open it again.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className='h-[80vh] w-full mt-4'>
            {pdfHistory.map((item, index) => (
              <Button
                key={index}
                variant='ghost'
                className='w-full justify-start mb-2'
                onClick={() => openHistoryFile(item)}
              >
                {item.name}
                <span className='ml-auto text-xs text-muted-foreground'>
                  {new Date(item.lastOpened).toLocaleString()}
                </span>
              </Button>
            ))}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default App;
