import { ThemeProvider } from '@/components/theme-provider';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { pdfjs } from 'react-pdf';
import { BrowserRouter } from 'react-router-dom';

import App from './App.tsx';
import { Toaster } from './components/ui/sonner';
import './index.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme='system' storageKey='vite-ui-theme'>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>
);
