import { IDBPDatabase } from 'idb';
import 'katex/dist/katex.min.css';
import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { toast } from 'sonner';

import { CommandMenu } from './components/command-menu';
import { Navbar } from './components/navbar';
import { Workspace as WorkspaceComponent } from './components/workspace';
import { WorkspacesPane } from './components/workspaces-pane';
import * as ai from './lib/ai';
import * as database from './lib/database';
import { extractText, fileToArrayBuffer } from './lib/pdf';
import { chunkText } from './lib/utils';
import { Workspace, relevantChunks } from './lib/workspace';

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chunks, setChunks] = useState<string[]>([]);
  const [db, setDb] = useState<IDBPDatabase | undefined>(undefined);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState<string>('');
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
    setIsLoading(true);

    try {
      database.getAll('workspaces').then((workspaces) => {
        setWorkspaces(workspaces);

        const mostRecent = mostRecentWorkspace(workspaces);

        if (mostRecent) {
          setFileUrl(
            URL.createObjectURL(
              new Blob([mostRecent.content], { type: 'application/pdf' })
            )
          );
        }

        setIsLoading(false);
      });
    } catch (error) {
      toast.error('Failed to load workspaces');
    }
  };

  const mostRecentWorkspace = (workspaces: Workspace[]): Workspace => {
    return workspaces.reduce((a, b) =>
      new Date(a.lastOpened).getTime() > new Date(b.lastOpened).getTime()
        ? a
        : b
    );
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

  const index = async (pdfFile: File) => {
    const time = performance.now();

    if (!db) {
      toast.error('Database not initialized');
      return;
    }

    const arrayBuffer = await fileToArrayBuffer(pdfFile);

    const chunks = chunkText(await extractText(arrayBuffer));
    setChunks(chunks);

    const embeddings = await ai.embed(chunks);
    if (embeddings) setEmbeddings(embeddings);

    await db.put('chunks', chunks, pdfFile.name);
    await db.put('embeddings', embeddings, pdfFile.name);

    const elapsed = performance.now() - time;

    toast.success(`Indexed ${pdfFile.name} in ${Math.round(elapsed / 1000)}s`);
  };

  const loadIndex = async (fileName: string) => {
    console.debug(`Loading index for ${fileName}`);

    if (!db) {
      toast.error('Database not initialized');
      return false;
    }

    const storedChunks = await db.get('chunks', fileName);
    const storedEmbeddings = await db.get('embeddings', fileName);

    if (storedChunks && storedEmbeddings) {
      setChunks(storedChunks);
      setEmbeddings(storedEmbeddings);
      return true;
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

      setIsLoading(true);

      try {
        const arrayBuffer = await fileToArrayBuffer(selectedFile);

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
      } finally {
        setIsLoading(false);
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

      setIsLoading(true);

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
      } finally {
        setIsLoading(false);
      }
    },
    [db]
  );

  const askQuestion = async (question: string) => {
    console.debug('Asking question:', question);

    const context = await relevantChunks({
      chunks,
      embeddings,
      question,
      topK: 5,
    });

    const answer = await ai.ask({
      context: context.join(' '),
      question,
      // TODO: get this to be configurable
      model: 'gpt-3.5-turbo',
    });

    console.log(answer);

    if (answer) setNotes((notes) => notes + answer);
    else toast.error('Failed to answer question');
  };

  return (
    <div className='m-2'>
      <Navbar />
      <main className='m-8'>
        {isLoading ? (
          <div className='flex h-[calc(100vh-200px)] items-center justify-center'>
            <div className='text-center'>
              <Loader2 className='mb-4 h-12 w-12 animate-spin text-muted-foreground' />
            </div>
          </div>
        ) : fileUrl ? (
          <WorkspaceComponent
            notes={notes}
            setNotes={setNotes}
            askQuestion={askQuestion}
            file={fileUrl}
          />
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
