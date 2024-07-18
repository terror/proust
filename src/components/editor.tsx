import { MathExtension } from '@aarkue/tiptap-math-extension';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const Editor: React.FC<EditorProps> = ({
  content,
  className,
  onBlur,
  placeholder = "What's on your mind?",
  autoFocus = false,
}) => {
  const editor = useEditor({
    extensions: [
      MathExtension.configure({ evaluation: false }),
      Placeholder.configure({ placeholder }),
      StarterKit,
    ],
    content,
    onBlur,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none text-lg',
      },
    },
  });

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
};
