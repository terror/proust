import { Workspace } from '@/App';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@radix-ui/react-scroll-area';

import { Button } from './ui/button';

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
          {workspaces.map((item, index) => (
            <Button
              key={index}
              variant='ghost'
              className='mb-2 w-full justify-start'
              onClick={() => onOpenWorkspace(item)}
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
  );
};
