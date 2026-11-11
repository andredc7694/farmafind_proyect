import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bootstrap } from './Bootstrap.jsx';
import './style.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><Bootstrap /></React.StrictMode>);
