import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjs, Document, Page } from 'react-pdf';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { openDB, IDBPDatabase } from 'idb';
import axios from 'axios';
import { cn } from './lib/utils';

import { MathExtension } from '@aarkue/tiptap-math-extension'
import 'katex/dist/katex.min.css';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
    <ScrollArea className='h-[900px]'>
      <div className='p-4'>
        <h2 className='text-lg font-semibold mb-2'>Table of Contents</h2>
        {outline.length > 0 ? (
          renderTOCItems(outline)
        ) : (
          <p>No table of contents available</p>
        )}
      </div>
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
const maxWidth = 600;

type PDFFile = string | File | null;

type WorkspaceProps = {
  file: PDFFile;
};

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { Extension } from '@tiptap/core';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Textarea } from './components/ui/textarea';

const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: query => [
          { title: 'Ask Question', command: () => askQuestion(query.query) },
          // Add more commands as needed
        ],
        render: () => {
          let component: any;
          let popup: any;

          return {
            onStart: props => {
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
  items: Array<{ title: string; command: () => void }>;
  command: (item: { title: string; command: () => void }) => void;
}

const EditorCommandList: React.FC<EditorCommandListProps> = ({ items, command }) => (
  <div className="bg-white shadow-xl rounded-lg overflow-hidden">
    {items && items.map((item, index) => (
      <button
        key={index}
        onClick={() => command(item)}
        className="block w-full text-left px-4 py-2 hover:bg-gray-100"
      >
        {item.title}
      </button>
    ))}
  </div>
);

const askQuestion = async (query: string) => {
  // Implement your question-answering logic here
  // This could involve calling an API or using the existing answerQuestion function
  console.log("Asking question:", query);
  // For now, we'll just return a placeholder response
  return "This is a placeholder response to your question: " + query;
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
              title: 'Ask Question',
              command: ({  }: { editor: any }) => {
                askQuestion(query).then(response => {
                  setAiResponse(response);
                });
              },
            },
            {
              title: 'Insert LaTeX',
              command: ({ editor }: { editor: any }) => {
                editor.commands.insertContent('$$\\LaTeX$$');
              },
            },
          ],
        },
      }),
MathExtension.configure({ evaluation: true })
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
      <EditorContent editor={editor} rendereditable={<CustomEditable placeholder={placeholder}/>} />
      {aiResponse && (
        <div className="mt-4">
          <p>AI Response:</p>
          <div className="bg-gray-100 p-2 rounded">{aiResponse}</div>
          <button onClick={insertAiResponse} className="mt-2 bg-blue-500 text-white px-4 py-2 rounded">
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

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>();
  const [selectedText, setSelectedText] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const [content, setContent] = useState<string>('');
  const [key, setKey] = useState<number>(0); // New state for forcing re-render

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
    setCurrentPage(1); // Reset to first page when new document is loaded
  };

  useEffect(() => {
    // Reset state when file changes
    setPdf(null);
    setCurrentPage(1);
    setNumPages(undefined);
    setSelectedText('');
    setScale(1);
    setKey((prevKey) => prevKey + 1); // Increment key to force re-render
  }, [file]);

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
    <ResizablePanelGroup
      className='h-[calc(100vh-120px)]'
      direction='horizontal'
    >
      <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
        <div className='h-full overflow-hidden'>
          <TableOfContents pdf={pdf} onItemClick={setCurrentPage} />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel className='m-4'>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              ref={setContainerRef}
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
              className='flex flex-col items-center'
            >
              <Document
                key={key} // Add key prop here
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
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={25}>
        <Editor placeholder='Take some notes...' className='m-4' content={content} onChange={setContent} />
      </ResizablePanel>
    </ResizablePanelGroup>
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
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfHistory, setPdfHistory] = useState<PDFHistory[]>([]);
  const [db, setDb] = useState<IDBPDatabase | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [chunks, setChunks] = useState<string[]>([]);
  const [question, _setQuestion] = useState<string>('');
  const [_answer, setAnswer] = useState<string>('');
  const [notes, _setNotes] = useState<string>('');

  useEffect(() => {
    const initDB = async () => {
      const database = await openDB('PDFStorage', 2, {
        upgrade(db, oldVersion, _newVersion, _transaction) {
          if (oldVersion < 1) {
            db.createObjectStore('pdfs');
          }
          if (oldVersion < 2) {
            db.createObjectStore('chunks');
            db.createObjectStore('embeddings');
          }
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

  const getEmbeddings = async (texts: string[]) => {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: texts,
          model: 'text-embedding-ada-002',
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('Error getting embeddings:', error);
      return null;
    }
  };

  const indexPDF = async (pdfFile: File) => {
    const time = performance.now();

    const arrayBuffer = await processPDF(pdfFile);
    const text = await extractTextFromPDF(arrayBuffer);

    const textChunks = chunkText(text);
    setChunks(textChunks);

    const embeddingsArray = await getEmbeddings(textChunks);

    if (embeddingsArray)
      setEmbeddings(embeddingsArray);

    if (db) {
      await db.put('chunks', textChunks, pdfFile.name);
      await db.put('embeddings', embeddingsArray, pdfFile.name);
    }

    const elapsed = performance.now() - time;

    toast(`Successfully indexed ${pdfFile.name} in ${elapsed}ms`)
  };

  const loadIndex = async (fileName: string) => {
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
          const indexLoaded = await loadIndex(selectedFile.name);
          if (!indexLoaded) {
            await indexPDF(selectedFile);
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
            setFileUrl(URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/pdf' })));

            const updatedHistory = pdfHistory.map((item) =>
              item.name === historyItem.name
                ? { ...item, lastOpened: new Date().toISOString() }
                : item
            );

            setPdfHistory(updatedHistory);
            saveToLocalStorage(updatedHistory);

            await loadIndex(historyItem.name);
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

    const questionEmbedding = await getEmbeddings([question]);
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

  const answerQuestion = async () => {
    if (!question) return;

    const relevantChunks = await findMostRelevantChunks(question);
    const context = relevantChunks.join(' ');

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that answers questions based on the given context.',
            },
            {
              role: 'user',
              content: `Context: ${context}\n\nQuestion: ${question}\n\nAnswer:`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setAnswer(response.data.choices[0].message.content);
    } catch (error) {
      setAnswer(
        'Sorry, I encountered an error while trying to answer your question.'
      );
    }
  };

  return (
    <div className='m-2'>
      <Navbar />
      <main className='m-8'>
        {fileUrl && <Workspace file={fileUrl} />}
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
