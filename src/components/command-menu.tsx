import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { BookText, File } from 'lucide-react';
import { useEffect, useState } from 'react';

export const CommandMenu = ({
  onOpenFile,
  onOpenWorkspaces,
}: {
  onOpenFile: () => void;
  onOpenWorkspaces: () => void;
}) => {
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
};
