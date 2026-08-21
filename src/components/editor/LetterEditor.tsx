// Lightweight Word-like letter editor.
//
// Deliberately built on contentEditable + document.execCommand rather than a
// full editor framework: the letter needs paragraphs, inline formatting,
// lists, alignment and fonts — not an office suite. execCommand is legacy but
// universally supported for exactly this command set, costs 0 KB, and both
// the client sanitizer and the server sanitizer act as the trust boundary for
// whatever the DOM produces.
//
// React never renders children into the editable region — the DOM is managed
// imperatively (innerHTML set once on mount). This removes the class of
// "React tries to reconcile nodes the user/browser already changed" crashes
// that could white-screen v1.
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import { sanitizeLetterHtml } from '@/utils/sanitizeHtml';

export interface LetterEditorHandle {
  focus: () => void;
  getHtml: () => string;
  /** Apply font to selection (if any) — returns true when applied. */
  applyFontFamily: (family: string) => boolean;
}

interface LetterEditorProps {
  initialHtml: string;
  placeholderLines: string[];
  fontFamily: string;
  minHeightClass?: string;
  onChange?: (html: string) => void;
}

type Cmd =
  | 'bold' | 'italic' | 'underline' | 'strikeThrough'
  | 'insertOrderedList' | 'insertUnorderedList'
  | 'justifyLeft' | 'justifyCenter' | 'justifyRight'
  | 'undo' | 'redo';

const QUERYABLE: Cmd[] = ['bold', 'italic', 'underline', 'strikeThrough', 'insertOrderedList', 'insertUnorderedList'];

function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  ul: 'M5 3.5 H14 M5 8 H14 M5 12.5 H14 M2 3.5 H2.01 M2 8 H2.01 M2 12.5 H2.01',
  ol: 'M6 3.5 H14 M6 8 H14 M6 12.5 H14 M2 2.2 L3 1.8 V5 M1.8 7 Q3.2 6 3.2 7.5 Q3.2 8.2 1.8 9.2 H3.4 M1.8 11 H3 Q3.6 11.4 3 12 Q3.6 12.6 3 13.2 H1.8',
  alignLeft: 'M2 3.5 H14 M2 6.5 H10 M2 9.5 H14 M2 12.5 H10',
  alignCenter: 'M2 3.5 H14 M4 6.5 H12 M2 9.5 H14 M4 12.5 H12',
  alignRight: 'M2 3.5 H14 M6 6.5 H14 M2 9.5 H14 M6 12.5 H14',
  undo: 'M6 3 L2.5 6.5 L6 10 M2.5 6.5 H10 Q13.5 6.5 13.5 10 Q13.5 13 10 13 H8',
  redo: 'M10 3 L13.5 6.5 L10 10 M13.5 6.5 H6 Q2.5 6.5 2.5 10 Q2.5 13 6 13 H8',
};

const LetterEditor = forwardRef<LetterEditorHandle, LetterEditorProps>(function LetterEditor(
  { initialHtml, placeholderLines, fontFamily, minHeightClass = 'min-h-[320px] md:min-h-[440px]', onChange },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [showMore, setShowMore] = useState(false);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setEmpty(!el.textContent?.trim() && !el.querySelector('li'));
    onChange?.(el.innerHTML);
  }, [onChange]);

  // Mount once; React never manages these children afterwards.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = sanitizeLetterHtml(initialHtml) || '';
    setEmpty(!el.textContent?.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStates = useCallback(() => {
    const el = editorRef.current;
    if (!el || !document.activeElement || !el.contains(window.getSelection()?.anchorNode || null)) return;
    const next: Record<string, boolean> = {};
    for (const cmd of QUERYABLE) {
      try { next[cmd] = document.queryCommandState(cmd); } catch { next[cmd] = false; }
    }
    setActiveStates(next);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshStates);
    return () => document.removeEventListener('selectionchange', refreshStates);
  }, [refreshStates]);

  const exec = useCallback((cmd: Cmd) => {
    editorRef.current?.focus();
    // Force tag output (<b>, <i>) instead of styled spans — Gecko/WebKit
    // otherwise emit CSS spans that would not survive sanitization.
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* older engines */ }
    document.execCommand(cmd, false);
    refreshStates();
    emitChange();
  }, [refreshStates, emitChange]);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    getHtml: () => editorRef.current?.innerHTML || '',
    applyFontFamily: (family: string) => {
      const el = editorRef.current;
      const selection = window.getSelection();
      if (!el || !selection || selection.rangeCount === 0) return false;
      if (!el.contains(selection.getRangeAt(0).commonAncestorContainer)) return false;
      el.focus();
      document.execCommand('fontName', false, family.replace(/'/g, ''));
      emitChange();
      return true;
    },
  }), [emitChange]);

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    if (html) {
      document.execCommand('insertHTML', false, sanitizeLetterHtml(html));
    } else {
      const text = event.clipboardData.getData('text/plain');
      if (text) document.execCommand('insertText', false, text);
    }
    emitChange();
  }, [emitChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (event.shiftKey) {
      const map: Record<string, Cmd> = {
        x: 'strikeThrough', '7': 'insertOrderedList', '8': 'insertUnorderedList',
        l: 'justifyLeft', e: 'justifyCenter', r: 'justifyRight',
      };
      if (map[key]) {
        event.preventDefault();
        exec(map[key]);
      }
      return;
    }
    // Handle B/I/U ourselves so every browser produces the same markup.
    const inlineMap: Record<string, Cmd> = { b: 'bold', i: 'italic', u: 'underline' };
    if (inlineMap[key]) {
      event.preventDefault();
      exec(inlineMap[key]);
    }
  }, [exec]);

  const button = (cmd: Cmd, label: string, content: React.ReactNode, extraClass = '') => (
    <button
      key={cmd}
      type="button"
      onMouseDown={(e) => e.preventDefault() /* keep selection */}
      onClick={() => exec(cmd)}
      aria-label={label}
      aria-pressed={activeStates[cmd] || undefined}
      title={label}
      className={`editor-tool ${activeStates[cmd] ? 'editor-tool-active' : ''} ${extraClass}`}
    >
      {content}
    </button>
  );

  return (
    <div>
      <div className="editor-toolbar no-print" role="toolbar" aria-label="Letter formatting">
        {button('bold', 'Bold (Ctrl+B)', <span className="font-bold font-body">B</span>)}
        {button('italic', 'Italic (Ctrl+I)', <span className="italic font-body">I</span>)}
        {button('underline', 'Underline (Ctrl+U)', <span className="underline font-body">U</span>)}
        <span className="editor-tool-divider hidden sm:inline-block" aria-hidden="true" />
        {button('insertUnorderedList', 'Bulleted list (Ctrl+Shift+8)', <Icon d={ICONS.ul} />)}
        {button('insertOrderedList', 'Numbered list (Ctrl+Shift+7)', <Icon d={ICONS.ol} />)}
        {/* Secondary controls: always visible on md+, behind a toggle on mobile */}
        <div className={`${showMore ? 'flex' : 'hidden'} md:flex items-center gap-0.5`}>
          {button('strikeThrough', 'Strikethrough (Ctrl+Shift+X)', <span className="line-through font-body">S</span>)}
          <span className="editor-tool-divider" aria-hidden="true" />
          {button('justifyLeft', 'Align left (Ctrl+Shift+L)', <Icon d={ICONS.alignLeft} />)}
          {button('justifyCenter', 'Align centre (Ctrl+Shift+E)', <Icon d={ICONS.alignCenter} />)}
          {button('justifyRight', 'Align right (Ctrl+Shift+R)', <Icon d={ICONS.alignRight} />)}
          <span className="editor-tool-divider" aria-hidden="true" />
          {button('undo', 'Undo (Ctrl+Z)', <Icon d={ICONS.undo} />)}
          {button('redo', 'Redo (Ctrl+Y)', <Icon d={ICONS.redo} />)}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowMore((v) => !v)}
          aria-label={showMore ? 'Fewer formatting tools' : 'More formatting tools'}
          aria-expanded={showMore}
          className="editor-tool md:hidden"
        >
          <span className="font-body">{showMore ? '−' : '⋯'}</span>
        </button>
      </div>

      <div className="relative">
        {empty && (
          <div className="editor-placeholder" aria-hidden="true">
            {placeholderLines.map((line, index) => (
              <p key={index} className={index > 0 ? 'mt-[1.9em]' : ''}>{line}</p>
            ))}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Letter content"
          lang=""
          spellCheck
          onInput={emitChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onFocus={refreshStates}
          className={`rich-letter-editor parchment-input w-full text-[17px] md:text-[18px] leading-[1.9em] ${minHeightClass} py-2 ink-engraved`}
          style={{ fontFamily, letterSpacing: '0.01em', wordSpacing: '0.05em' }}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
});

export default LetterEditor;
