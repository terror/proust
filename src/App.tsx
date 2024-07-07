import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { IDBPDatabase } from 'idb';
import 'katex/dist/katex.min.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { toast } from 'sonner';

import { CommandMenu } from './components/command-menu';
import { Navbar } from './components/navbar';
import { Workspace } from './components/workspace';
import * as ai from './lib/ai';
import * as database from './lib/database';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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
