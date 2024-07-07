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
import { WorkspacesPane } from './components/workspaces-pane';
import * as ai from './lib/ai';
import * as database from './lib/database';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export type Workspace = {
  content: ArrayBuffer;
  lastOpened: string;
  name: string;
  notes: string;
  size: number;
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const CHUNK_SIZE = 1000; // Number of characters per chunk

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chunks, setChunks] = useState<string[]>([]);
  const [db, setDb] = useState<IDBPDatabase | undefined>(undefined);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined);
  const [notes, _setNotes] = useState<string>('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesPaneOpen, setWorkspacesPaneOpen] = useState(false);

  useEffect(() => {
    database.open().then((database: IDBPDatabase) => {
      setDb(database);
      loadWorkspacesFromDatabase(database);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const loadWorkspacesFromDatabase = async (database: IDBPDatabase) => {
    try {
      const workspaces = await database.getAll('workspaces');
      setWorkspaces(workspaces);
    } catch (error) {
      console.error('Failed to load workspaces from database:', error);
      toast.error('Failed to load workspaces');
    }
  };

  const saveWorkspaceToDatabase = async (workspace: Workspace) => {
    if (!db) {
      toast.error('Database not initialized');
      return;
    }

    try {
      await db.put('workspaces', workspace, workspace.name);
      const updatedWorkspaces = await db.getAll('workspaces');
      setWorkspaces(updatedWorkspaces);
    } catch (error) {
      toast.error('Failed to save workspace');
    }
  };

  const process = async (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const extractText = async (arrayBuffer: ArrayBuffer): Promise<string> => {
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

    const arrayBuffer = await process(pdfFile);
    const text = await extractText(arrayBuffer);

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

  const onFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];

      if (!selectedFile) {
        toast.error('No file selected');
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        toast.error(`Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024} MB`);
        return;
      }

      if (!db) {
        toast.error('Database not initialized');
        return;
      }

      try {
        const arrayBuffer = await process(selectedFile);

        setFileUrl(
          URL.createObjectURL(
            new Blob([arrayBuffer], { type: 'application/pdf' })
          )
        );

        const newWorkspace: Workspace = {
          name: selectedFile.name,
          lastOpened: new Date().toISOString(),
          size: selectedFile.size,
          notes: '',
          content: arrayBuffer,
        };

        await saveWorkspaceToDatabase(newWorkspace);

        const indexLoaded = await loadIndex(selectedFile.name);

        if (!indexLoaded) await index(selectedFile);
      } catch (error) {
        toast.error(`Failed to open file: \`${error}\``);
      }
    },
    [db]
  );

  const openWorkspace = useCallback(
    async (workspace: Workspace) => {
      console.debug('Opening workspace:', workspace.name);

      if (!db) {
        toast.error('Database not initialized');
        return;
      }

      try {
        setFileUrl(
          URL.createObjectURL(
            new Blob([workspace.content], { type: 'application/pdf' })
          )
        );

        workspace.lastOpened = new Date().toISOString();
        await saveWorkspaceToDatabase(workspace);

        await loadIndex(workspace.name);
      } catch (error) {
        toast.error('Failed to open workspace');
      }
    },
    [db]
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

  const defaultState = () => {
    return (
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
    );
  };

  return (
    <div className='m-2'>
      <Navbar />
      <main className='m-8'>
        {fileUrl ? <Workspace file={fileUrl} /> : defaultState()}
      </main>
      <CommandMenu
        onOpenFile={() => fileInputRef.current?.click()}
        onOpenWorkspaces={() => setWorkspacesPaneOpen(true)}
      />
      <input
        ref={fileInputRef}
        type='file'
        accept='.pdf'
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
      <WorkspacesPane
        isOpen={workspacesPaneOpen}
        setIsOpen={setWorkspacesPaneOpen}
        onOpenWorkspace={openWorkspace}
        workspaces={workspaces}
      />
    </div>
  );
};

export default App;
