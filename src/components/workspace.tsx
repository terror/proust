import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { Sparkles } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Document, Page } from 'react-pdf';

import { Editor } from './editor';
import { Outline } from './outline';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

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

interface QuestionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText?: string;
  onSubmit: (question: string) => Promise<void>;
}

export const QuestionDialog: React.FC<QuestionDialogProps> = ({
  isOpen,
  onClose,
  selectedText,
  onSubmit,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [question, setQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    try {
      const q = selectedText ? `${selectedText}\n${question}` : question;
      await onSubmit(q);
      setQuestion('');
      onClose();
    } catch (error) {
      toast.error(`Failed to ask question: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (textareaRef.current) resize();
  }, [question]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>
            <div className='flex items-center space-x-2'>
              <p>Ask a question</p>
              <Sparkles className='h-5 w-5' />
            </div>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div>
            {selectedText && (
              <div className='my-4 border-l-4 border-gray-300 pl-4 italic text-gray-600'>
                {selectedText}
              </div>
            )}
            <Textarea
              id='question'
              value={question}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setQuestion(e.target.value)
              }
              ref={textareaRef}
              placeholder='Type your question here...'
              className='resize-none border-none p-0 text-lg focus-visible:ring-0 focus-visible:ring-offset-0'
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={isLoading || !question.trim()}>
              {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Run'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const Workspace: React.FC<{ file: PDFFile, askQuestion: (q: string) => Promise<void>, notes: string, setNotes: (n: string) => void }> = ({ file, askQuestion, notes, setNotes }) => {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  const [containerRef, setContainerRef] = React.useState<HTMLElement | null>(
    null
  );

  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);

  const handleAskQuestion = () => {
    setIsQuestionDialogOpen(true);
  };

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
          <ContextMenuItem onClick={handleAskQuestion}>
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
      <QuestionDialog
        isOpen={isQuestionDialogOpen}
        onSubmit={askQuestion}
        onClose={() => setIsQuestionDialogOpen(false)}
        selectedText={state.selectedText}
      />
    </ResizablePanel>
  );

  const renderEditorPanel = () => (
    <ResizablePanel defaultSize={25} minSize={20}>
      <Editor
        placeholder='Take some notes...'
        className='m-4'
        content={notes}
        onChange={setNotes}
      />
    </ResizablePanel>
  );

  return renderContent();
};
