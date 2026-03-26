// @ts-nocheck
// Vercel build sync trigger
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { registerServiceWorker } from './pwa';
import { prepareHostedRuntime } from './runtime/browserRuntime';
import reportWebVitals from './reportWebVitals';

document.documentElement.setAttribute(
  'data-theme',
  document.documentElement.getAttribute('data-theme') || 'dark'
);
document.documentElement.setAttribute(
  'data-layout',
  document.documentElement.getAttribute('data-layout') || 'default'
);

async function bootstrap() {
  await prepareHostedRuntime();

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
registerServiceWorker();
// CSP Force trigger