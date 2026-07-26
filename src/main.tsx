
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const theme = localStorage.getItem('going-dutch-theme') || 'dark';
document.documentElement.classList.toggle('dark', theme === 'dark');

createRoot(document.getElementById("root")!).render(<App />);
