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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { OutlineItem, parseOutline } from '@/lib/pdf';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';

import { Editor } from './editor';
import { Outline } from './outline';

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

type PDFFile = string | File | null;

type WorkspaceProps = {
  file: PDFFile;
};

export const Workspace = ({ file }: WorkspaceProps) => {
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();

  const [content, setContent] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [key, setKey] = useState<number>(0); // New state for forcing re-render
  const [numPages, setNumPages] = useState<number>();
  const [outline, setOutline] = useState<OutlineItem[]>();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [selectedText, setSelectedText] = useState<string>('');

  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries;
    if (entry) setContainerWidth(entry.contentRect.width);
  }, []);

  useResizeObserver(containerRef, {}, onResize);

  const onDocumentLoadSuccess = async (
    pdf: PDFDocumentProxy
  ): Promise<void> => {
    setCurrentPage(1);
    setNumPages(pdf.numPages);
    setOutline(await parseOutline(pdf));
    setPdf(pdf);
  };

  useEffect(() => {
    setCurrentPage(1);
    setKey((prevKey) => prevKey + 1);
    setNumPages(undefined);
    setPdf(null);
    setScale(1);
    setSelectedText('');
  }, [file]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        if (event.key === 'l')
          setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
        else if (event.key === 'h')
          setCurrentPage((prev) => Math.max(prev - 1, 1));
      } else {
        if (event.key === '+') setScale((prev) => Math.min(prev + 0.1, 2));
        else if (event.key === '-')
          setScale((prev) => Math.max(prev - 0.1, 0.5));
        else if (event.key === '0') setScale(1);
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

  const onItemClick = async (item: { pageNumber: string | number }) => {
    setCurrentPage(
      typeof item.pageNumber === 'string'
        ? parseInt(item.pageNumber, 10)
        : item.pageNumber
    );
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

  const renderContent = () => {
    if (outline && outline.length !== 0) {
      return (
        <ResizablePanelGroup
          direction='horizontal'
          className='h-[calc(100vh-120px)]'
        >
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
            <div className='h-full overflow-hidden'>
              <Outline outline={outline} onItemClick={setCurrentPage} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          {renderMainPanel()}
          <ResizableHandle withHandle />
          {renderEditorPanel()}
        </ResizablePanelGroup>
      );
    } else {
      return (
        <ResizablePanelGroup
          direction='horizontal'
          className='h-[calc(100vh-120px)]'
        >
          {renderMainPanel()}
          <ResizableHandle withHandle />
          {renderEditorPanel()}
        </ResizablePanelGroup>
      );
    }
  };

  const renderMainPanel = () => (
    <ResizablePanel className='m-4' minSize={30}>
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
              key={key}
              onItemClick={onItemClick}
              onLoadSuccess={onDocumentLoadSuccess}
              options={options}
            >
              <Page
                pageNumber={currentPage}
                width={
                  containerWidth
                    ? Math.min(containerWidth, 600) * scale
                    : 600 * scale
                }
              />
            </Document>
            {numPages && (
              <Pagination className='mb-4 mt-4 cursor-pointer'>
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
            <MessageSquare className='mr-2 h-4 w-4' />
            Ask a question
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={nextPage}>
            <ChevronRight className='mr-2 h-4 w-4' />
            <p className='mr-2'>Next page</p>
            <ContextMenuShortcut>⌃L</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={prevPage}>
            <ChevronLeft className='mr-2 h-4 w-4' />
            <p className='mr-2'>Previous page</p>
            <ContextMenuShortcut>⌃H</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </ResizablePanel>
  );

  const renderEditorPanel = () => (
    <ResizablePanel defaultSize={25} minSize={20}>
      <Editor
        placeholder='Take some notes...'
        className='m-4'
        content={content}
        onChange={setContent}
      />
    </ResizablePanel>
  );

  return renderContent();
};
