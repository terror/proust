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
import React, { useCallback, useEffect, useReducer } from 'react';
import { Document, Page } from 'react-pdf';

import { Editor } from './editor';
import { Outline } from './outline';

const MAX_PDF_WIDTH = 600;

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

type PDFFile = string | File | null;

type WorkspaceState = {
  containerWidth?: number;
  content: string;
  currentPage: number;
  key: number;
  numPages?: number;
  outline?: OutlineItem[];
  scale: number;
  selectedText: string;
};

type WorkspaceAction =
  | { type: 'SET_CONTAINER_WIDTH'; payload: number }
  | { type: 'SET_CONTENT'; payload: string }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_KEY'; payload: number }
  | { type: 'SET_NUM_PAGES'; payload: number }
  | { type: 'SET_OUTLINE'; payload: OutlineItem[] }
  | { type: 'SET_SCALE'; payload: number }
  | { type: 'SET_SELECTED_TEXT'; payload: string }
  | { type: 'RESET_FILE' };

const initialState: WorkspaceState = {
  content: '',
  currentPage: 1,
  key: 0,
  scale: 1,
  selectedText: '',
};

function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case 'SET_CONTAINER_WIDTH':
      return { ...state, containerWidth: action.payload };
    case 'SET_CONTENT':
      return { ...state, content: action.payload };
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_KEY':
      return { ...state, key: action.payload };
    case 'SET_NUM_PAGES':
      return { ...state, numPages: action.payload };
    case 'SET_OUTLINE':
      return { ...state, outline: action.payload };
    case 'SET_SCALE':
      return { ...state, scale: action.payload };
    case 'SET_SELECTED_TEXT':
      return { ...state, selectedText: action.payload };
    case 'RESET_FILE':
      return {
        ...state,
        currentPage: 1,
        key: state.key + 1,
        numPages: undefined,
        scale: 1,
        selectedText: '',
      };
    default:
      return state;
  }
}

export const Workspace: React.FC<{ file: PDFFile }> = ({ file }) => {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  const [containerRef, setContainerRef] = React.useState<HTMLElement | null>(
    null
  );

  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries;

    if (entry)
      dispatch({
        type: 'SET_CONTAINER_WIDTH',
        payload: entry.contentRect.width,
      });
  }, []);

  useResizeObserver(containerRef, {}, onResize);

  const onDocumentLoadSuccess = async (
    pdf: PDFDocumentProxy
  ): Promise<void> => {
    dispatch({ type: 'SET_CURRENT_PAGE', payload: 1 });
    dispatch({ type: 'SET_NUM_PAGES', payload: pdf.numPages });

    const outline = await parseOutline(pdf);

    if (outline) dispatch({ type: 'SET_OUTLINE', payload: outline });
  };

  useEffect(() => {
    dispatch({ type: 'RESET_FILE' });
  }, [file]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        if (event.key === 'l')
          dispatch({
            type: 'SET_CURRENT_PAGE',
            payload: Math.min(
              state.currentPage + 1,
              state.numPages || state.currentPage
            ),
          });
        else if (event.key === 'h')
          dispatch({
            type: 'SET_CURRENT_PAGE',
            payload: Math.max(state.currentPage - 1, 1),
          });
      } else {
        if (event.key === '+')
          dispatch({
            type: 'SET_SCALE',
            payload: Math.min(state.scale + 0.1, 2),
          });
        else if (event.key === '-')
          dispatch({
            type: 'SET_SCALE',
            payload: Math.max(state.scale - 0.1, 0.5),
          });
        else if (event.key === '0') dispatch({ type: 'SET_SCALE', payload: 1 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.currentPage, state.numPages, state.scale]);

  const nextPage = () => {
    dispatch({
      type: 'SET_CURRENT_PAGE',
      payload: Math.min(
        state.currentPage + 1,
        state.numPages || state.currentPage
      ),
    });
  };

  const prevPage = () => {
    dispatch({
      type: 'SET_CURRENT_PAGE',
      payload: Math.max(state.currentPage - 1, 1),
    });
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      dispatch({ type: 'SET_SELECTED_TEXT', payload: selection.toString() });
    }
  };

  const onItemClick = (pageNumber: number) => {
    dispatch({ type: 'SET_CURRENT_PAGE', payload: pageNumber });
  };

  const printSelectedText = () => {
    console.log('Selected Text:', state.selectedText);
  };

  const renderPaginationItems = () => {
    if (!state.numPages) return null;

    const items = [];
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);

    let start = Math.max(1, state.currentPage - halfVisible);
    let end = Math.min(state.numPages, start + maxVisiblePages - 1);

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
            onClick={() => dispatch({ type: 'SET_CURRENT_PAGE', payload: i })}
            isActive={state.currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (end < state.numPages) {
      items.push(
        <PaginationItem key='ellipsis-end'>
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    return items;
  };

  const renderContent = () => {
    if (state.outline && state.outline.length !== 0) {
      return (
        <ResizablePanelGroup
          direction='horizontal'
          className='h-[calc(100vh-120px)]'
        >
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
            <div className='h-full overflow-hidden'>
              <Outline outline={state.outline} onItemClick={onItemClick} />
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
              key={state.key}
              onItemClick={({ pageNumber }) =>
                onItemClick(pageNumber as number)
              }
              onLoadSuccess={onDocumentLoadSuccess}
              options={options}
            >
              <Page
                pageNumber={state.currentPage}
                width={
                  state.containerWidth
                    ? Math.min(state.containerWidth, MAX_PDF_WIDTH) *
                      state.scale
                    : MAX_PDF_WIDTH * state.scale
                }
              />
            </Document>
            {state.numPages && (
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
        content={state.content}
        onChange={(content) =>
          dispatch({ type: 'SET_CONTENT', payload: content })
        }
      />
    </ResizablePanel>
  );

  return renderContent();
};
