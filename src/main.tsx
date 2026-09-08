
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { readPreferences, resolveTheme } from './lib/preferences'

const preferences = readPreferences(window.localStorage, navigator.language);
const theme = resolveTheme(preferences.theme, window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.style.colorScheme = theme;
document.documentElement.lang = preferences.language;

createRoot(document.getElementById("root")!).render(<App />);
