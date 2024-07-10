import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { File } from 'lucide-react';

import { Workspace } from '../lib/workspace';

export const WorkspacesPane = ({
  isOpen,
  onOpenWorkspace,
  setIsOpen,
  workspaces,
}: {
  isOpen: boolean;
  onOpenWorkspace: (workspace: Workspace) => void;
  setIsOpen: (isOpen: boolean) => void;
  workspaces: Workspace[];
}) => {
  const sortedWorkspaces = [...workspaces].sort(
    (a, b) =>
      new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Workspaces</SheetTitle>
          <SheetDescription>
            Your recently opened workspaces. Click on one to open it again.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className='mt-4 h-[80vh] w-full'>
          {sortedWorkspaces.map((item, index) => (
            <Button
              key={index}
              variant='ghost'
              className='mb-2 w-full justify-start truncate py-6 text-left'
              onClick={() => {
                onOpenWorkspace(item);
                setIsOpen(false);
              }}
            >
              <div className='flex w-full items-center space-x-4'>
                <File className='flex-shrink-0' />
                <div className='min-w-0 flex-1 overflow-hidden'>
                  <p className='truncate'>
                    {item.name.endsWith('.pdf')
                      ? item.name.slice(0, -4)
                      : item.name}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Last opened on {new Date(item.lastOpened).toLocaleString()}
                  </p>
                </div>
              </div>
            </Button>
          ))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
