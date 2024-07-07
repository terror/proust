import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { Extension } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import { Command } from 'cmdk';
import { IDBPDatabase } from 'idb';
import 'katex/dist/katex.min.css';
import { BookText, File as FileIcon, MessageSquare } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { toast } from 'sonner';
import tippy from 'tippy.js';

import { Navbar } from './components/navbar';
import { Outline } from './components/outline';
import * as ai from './lib/ai';
import * as database from './lib/database';
import { OutlineItem, parseOutline } from './lib/pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

type PDFFile = string | File | null;

type WorkspaceProps = {
  file: PDFFile;
};

const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: (query) => [
          { title: 'Ask a question', command: () => askQuestion(query.query) },
        ],
        render: () => {
          let component: any;
          let popup: any;

          return {
            onStart: (props) => {
              component = new ReactRenderer(EditorCommandList, {
                props,
                editor: props.editor,
              });

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate(props) {
              component.updateProps(props);

              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }

              return component.ref?.onKeyDown(props);
            },

            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});

interface EditorCommandListProps {
  items: Array<{ title: string; icon: string; command: () => void }>;
  command: (item: { title: string; icon: string; command: () => void }) => void;
}

const iconMap: { [key: string]: React.ReactNode } = {
  'Ask a question': <MessageSquare className='h-5 w-5' />,
};

export const EditorCommandList: React.FC<EditorCommandListProps> = ({
  items,
  command,
}) => (
  <Command className='overflow-hidden rounded-lg border bg-white shadow-md dark:bg-gray-800'>
    <Command.List className='max-h-64 overflow-y-auto py-2'>
      <Command.Empty className='px-4 py-2 text-sm text-gray-500 dark:text-gray-400'>
        No results found.
      </Command.Empty>
      {items.map((item, index) => (
        <Command.Item
          key={index}
          onSelect={() => command(item)}
          className='flex cursor-pointer items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700'
        >
          <span className='mr-3 text-gray-500 dark:text-gray-400'>
            {iconMap[item.icon] || iconMap['Ask a question']}
          </span>
          <span className='flex-grow'>{item.title}</span>
        </Command.Item>
      ))}
    </Command.List>
  </Command>
);

const askQuestion = async (query: string) => {
  console.log('Asking question:', query);
  return 'This is a placeholder response to your question: ' + query;
};

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

const CustomEditable = React.forwardRef((props: any, ref: any) => {
  return <Textarea className='text-lg' {...props} ref={ref} />;
});

export const Editor: React.FC<EditorProps> = ({
  content,
  onChange,
  className,
  onBlur,
  placeholder = "What's on your mind?",
  autoFocus = false,
}) => {
  const [aiResponse, setAiResponse] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      SlashCommands.configure({
        suggestion: {
          items: (query: string) => [
            {
              title: 'Ask a question',
              command: ({}: { editor: any }) => {
                askQuestion(query).then((response) => {
                  setAiResponse(response);
                });
              },
            },
          ],
        },
      }),
      MathExtension.configure({ evaluation: false }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none',
      },
    },
  });

  const insertAiResponse = useCallback(() => {
    editor?.commands.insertContent(aiResponse);
    setAiResponse('');
  }, [editor, aiResponse]);

  return (
    <div className={className}>
      <EditorContent
        editor={editor}
        rendereditable={<CustomEditable placeholder={placeholder} />}
      />
      {aiResponse && (
        <div className='mt-4'>
          <p>AI Response:</p>
          <div className='rounded bg-gray-100 p-2'>{aiResponse}</div>
          <button
            onClick={insertAiResponse}
            className='mt-2 rounded bg-blue-500 px-4 py-2 text-white'
          >
            Insert Response
          </button>
        </div>
      )}
    </div>
  );
};

const Workspace = ({ file }: WorkspaceProps) => {
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

function CommandMenu({
  onOpenFile,
  onOpenWorkspaces,
}: {
  onOpenFile: () => void;
  onOpenWorkspaces: () => void;
}) {
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
            <span>Open a file</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenWorkspaces();
              setOpen(false);
            }}
          >
            <BookText className='mr-2 h-4 w-4' />
            <span>View workspaces</span>
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
  notes: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const CHUNK_SIZE = 1000; // Number of characters per chunk

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [_answer, setAnswer] = useState<string>('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [db, setDb] = useState<IDBPDatabase | undefined>(undefined);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [notes, _setNotes] = useState<string>('');
  const [pdfHistory, setPdfHistory] = useState<PDFHistory[]>([]);
  const [question, _setQuestion] = useState<string>('');

  useEffect(() => {
    database.open().then((database: IDBPDatabase) => setDb(database));
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

  /*
   * Extract text from PDF using pdf.js.
   */
  const extractTextFromPDF = async (
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

  const chunkText = (text: string): string[] => {
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  };

  const index = async (pdfFile: File) => {
    const time = performance.now();

    const arrayBuffer = await processPDF(pdfFile);
    const text = await extractTextFromPDF(arrayBuffer);

    const textChunks = chunkText(text);
    setChunks(textChunks);

    const embeddingsArray = await ai.embed(textChunks);

    if (embeddingsArray) setEmbeddings(embeddingsArray);

    if (db) {
      await db.put('chunks', textChunks, pdfFile.name);
      await db.put('embeddings', embeddingsArray, pdfFile.name);
    }

    const elapsed = performance.now() - time;

    toast.success(`Indexed ${pdfFile.name} in ${Math.round(elapsed / 1000)}s`);
  };

  const load = async (fileName: string) => {
    if (db) {
      const storedChunks = await db.get('chunks', fileName);
      const storedEmbeddings = await db.get('embeddings', fileName);

      if (storedChunks && storedEmbeddings) {
        setChunks(storedChunks);
        setEmbeddings(storedEmbeddings);
        return true;
      }
    }

    return false;
  };

  const openWorkspaces = useCallback(() => {
    setIsSheetOpen(true);
  }, []);

  const onFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile && db) {
        if (selectedFile.size > MAX_FILE_SIZE) {
          toast(
            `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`
          );
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
              notes,
            },
            ...pdfHistory.filter((item) => item.name !== selectedFile.name),
          ].slice(0, 10);

          setPdfHistory(newHistory);
          saveToLocalStorage(newHistory);

          // Check if index exists, if not, create it
          const indexLoaded = await load(selectedFile.name);
          if (!indexLoaded) {
            await index(selectedFile);
          }
        } catch (error) {
          console.error('Error processing file:', error);
          toast('Failed to process the PDF file. Please try again.');
        }
      }
    },
    [db, pdfHistory, saveToLocalStorage]
  );

  const openHistoryFile = useCallback(
    async (historyItem: PDFHistory) => {
      if (db) {
        try {
          const arrayBuffer = await db.get('pdfs', historyItem.name);

          if (arrayBuffer) {
            setFileUrl(
              URL.createObjectURL(
                new Blob([arrayBuffer], { type: 'application/pdf' })
              )
            );

            const updatedHistory = pdfHistory.map((item) =>
              item.name === historyItem.name
                ? { ...item, lastOpened: new Date().toISOString() }
                : item
            );

            setPdfHistory(updatedHistory);
            saveToLocalStorage(updatedHistory);

            await load(historyItem.name);
          } else {
            toast(
              `File "${historyItem.name}" not found in storage. Please open it again.`
            );
          }
        } catch (error) {
          console.error('Error opening file from history:', error);
          toast('Failed to open the PDF file. Please try again.');
        }
      }
    },
    [db, pdfHistory, saveToLocalStorage]
  );

  const findMostRelevantChunks = async (question: string, topK: number = 3) => {
    if (!embeddings.length) return [];

    const questionEmbedding = await ai.embed([question]);

    if (!questionEmbedding) return [];

    const similarities = embeddings.map((emb, i) => ({
      index: i,
      similarity: cosineSimilarity(questionEmbedding[0], emb),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK).map((item) => chunks[item.index]);
  };

  const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  };

  return (
    <div className='m-2'>
      <Navbar />
      <main className='m-8'>
        {fileUrl ? (
          <Workspace file={fileUrl} />
        ) : (
          <div className='flex h-[calc(100vh-200px)] items-center justify-center'>
            <div className='text-center'>
              <p className='mb-2 text-2xl font-semibold'>No workspace loaded</p>
              <p className='text-muted-foreground'>
                Press{' '}
                <kbd className='rounded-lg border border-gray-200 bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-800'>
                  ⌘ K
                </kbd>{' '}
                to open the command menu
              </p>
            </div>
          </div>
        )}
      </main>
      <CommandMenu
        onOpenFile={() => fileInputRef.current?.click()}
        onOpenWorkspaces={openWorkspaces}
      />
      <input
        ref={fileInputRef}
        type='file'
        accept='.pdf'
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Workspaces</SheetTitle>
            <SheetDescription>
              Your recently opened PDFs. Click on one to open it again.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className='mt-4 h-[80vh] w-full'>
            {pdfHistory.map((item, index) => (
              <Button
                key={index}
                variant='ghost'
                className='mb-2 w-full justify-start'
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
