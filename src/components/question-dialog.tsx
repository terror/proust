import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Textarea } from './ui/textarea';

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
              <div className='mb-4 border-l-4 border-gray-300 pl-4 italic text-gray-600'>
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
              className='resize-none border-none p-1 text-lg focus-visible:ring-0 focus-visible:ring-offset-0'
            />
          </div>
          <DialogFooter>
            <Button
              className='w-full'
              type='submit'
              disabled={isLoading || !question.trim()}
            >
              {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Ask'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
