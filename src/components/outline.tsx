import React from 'react';

import { OutlineItem } from '../lib/pdf';
import { ScrollArea } from './ui/scroll-area';

const OutlineList: React.FC<{
  items: OutlineItem[];
  depth: number;
  onItemClick: (pageNumber: number) => void;
}> = ({ items, depth, onItemClick }) => (
  <ul className={`pl-${depth * 4}`}>
    {items.map((item, index) => (
      <li key={index} className='my-1'>
        <button
          className='text-left hover:underline focus:outline-none'
          onClick={() => onItemClick(item.pageNumber)}
        >
          {item.title}
        </button>
        {item.items && (
          <OutlineList
            items={item.items}
            depth={depth + 1}
            onItemClick={onItemClick}
          />
        )}
      </li>
    ))}
  </ul>
);

interface OutlineProps {
  outline: OutlineItem[];
  onItemClick: (pageNumber: number) => void;
}

export const Outline: React.FC<OutlineProps> = ({ outline, onItemClick }) => {
  return (
    <ScrollArea className='h-[900px]'>
      <div className='p-4'>
        <h2 className='mb-2 text-lg font-semibold'>Table of Contents</h2>
        <OutlineList items={outline} depth={0} onItemClick={onItemClick} />
      </div>
    </ScrollArea>
  );
};
