import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Load Monaco from our own bundle instead of a CDN, so it works offline.
loader.config({ monaco });

export default function CodeEditor({ language, value, onChange }) {
  return (
    <Editor
      height="420px"
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      theme="vs-dark"
      options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false }}
    />
  );
}
