'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { T } from '@/app/theme';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Begriff eingeben, Enter drücken…' }: Props) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput('');
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
        padding: '6px 10px',
        minHeight: 38,
        background: T.panel2,
        border: `1px solid ${focused ? T.gold : T.line}`,
        borderRadius: 6,
        cursor: 'text',
        transition: 'border-color .15s',
        boxShadow: focused ? `0 0 0 2px var(--th-gold-d)` : 'none',
      }}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: T.goldD,
            border: `1px solid ${T.line}`,
            borderRadius: 4,
            padding: '2px 8px',
            fontFamily: T.ffMono,
            fontSize: 11,
            color: T.gold,
            whiteSpace: 'nowrap',
          }}
        >
          {tag}
          <button
            onClick={e => { e.stopPropagation(); removeTag(i); }}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 0 0 2px',
              cursor: 'pointer',
              fontFamily: T.ffMono,
              fontSize: 13,
              color: T.inkF,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          flex: '1 1 160px',
          minWidth: 80,
          background: 'none',
          border: 'none',
          outline: 'none',
          fontFamily: T.ffMono,
          fontSize: 12,
          color: T.ink,
          padding: '2px 0',
          boxShadow: 'none',
          width: 'auto',
        }}
      />
    </div>
  );
}
