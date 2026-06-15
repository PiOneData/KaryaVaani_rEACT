import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/app.css';

/* NOTE: StrictMode is intentionally omitted — the legacy application logic
   (public/legacy/app.js) is loaded once after mount and must not run twice. */
createRoot(document.getElementById('root')).render(<App />);
