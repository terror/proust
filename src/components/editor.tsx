import { MathExtension } from '@aarkue/tiptap-math-extension';
import { Extension } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import { Command } from 'cmdk';
import { MessageSquare } from 'lucide-react';
import { forwardRef, useCallback, useState } from 'react';
import tippy from 'tippy.js';

import { Textarea } from './ui/textarea';

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

const CustomEditable = forwardRef((props: any, ref: any) => {
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
