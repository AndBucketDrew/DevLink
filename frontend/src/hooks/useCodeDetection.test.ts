// src/hooks/useCodeDetection.test.ts
import { renderHook } from '@testing-library/react';
import { useCodeDetection, useIsCode, useCodeStyling, detectCode } from './useCodeDetection';
import { describe, it, expect } from 'vitest';

describe('detectCode (core function)', () => {
  it('returns false for short or empty text', () => {
    expect(detectCode('').isCode).toBe(false);
    expect(detectCode('hi').isCode).toBe(false);
    expect(detectCode('   ').isCode).toBe(false);
  });

  it('returns false for normal conversational text', () => {
    const result = detectCode('Hey, how are you doing today? I just finished my project.');
    expect(result.isCode).toBe(false);
    expect(result.matchCount).toBe(0);
    expect(result.badge).toBeNull();
  });

  it('detects triple-backtick code blocks', () => {
    const code = '```ts\nconst x: number = 42;\nconsole.log(x);\n```';
    const result = detectCode(code);
    expect(result.isCode).toBe(true);
    expect(result.matchedPatterns).toContain('code-blocks');
  });

  it('detects JavaScript/TypeScript keywords', () => {
    const tests = [
      'const user = { name: "John" };',
      'function calculateTotal() {}',
      'const result = items.map(item => item.price);',
      'import React from "react";',
      'export default App;',
    ];

    tests.forEach((text) => {
      const result = detectCode(text);
      expect(result.isCode).toBe(true);
      expect(result.matchCount).toBeGreaterThan(0);
    });
  });

  it('detects Python keywords', () => {
    const result = detectCode('def process_data(items):\n    return [x * 2 for x in items]');
    expect(result.isCode).toBe(true);
    expect(result.matchedPatterns).toContain('python-keywords');
  });

  it('detects structural code patterns (brackets, arrows, etc.)', () => {
    const result = detectCode('const add = (a, b) => a + b;');
    expect(result.isCode).toBe(true);
    expect(result.matchedPatterns).toContain('arrow-functions');
    expect(result.matchedPatterns).toContain('brackets');
  });

  it('detects HTML tags', () => {
    const result = detectCode('<div className="container">Hello</div>');
    expect(result.isCode).toBe(true);
    expect(result.matchedPatterns).toContain('html-tags');
  });

  it('respects minLength configuration', () => {
    const shortCode = 'const x = 5;';
    expect(detectCode(shortCode, { minLength: 50 }).isCode).toBe(false);
    expect(detectCode(shortCode, { minLength: 5 }).isCode).toBe(true);
  });

  it('supports custom patterns', () => {
    const customPatterns: RegExp[] = [/TODO:/i, /FIXME:/i];

    const result1 = detectCode('TODO: refactor this later', { customPatterns });
    expect(result1.isCode).toBe(true);
    expect(result1.matchedPatterns).toContain('custom-0');

    const result2 = detectCode('Just normal text', { customPatterns });
    expect(result2.isCode).toBe(false);
  });

  it('correctly segments text into code and text parts', () => {
    const mixedText = `Hello world!

const greeting = "Hi";
console.log(greeting);

This is normal text again.`;

    const result = detectCode(mixedText);

    expect(result.segments.length).toBeGreaterThan(1);

    const codeSegment = result.segments.find((s) => s.type === 'code');
    const textSegments = result.segments.filter((s) => s.type === 'text');

    expect(codeSegment).toBeDefined();
    expect(textSegments.length).toBeGreaterThan(1);
    expect(codeSegment!.content).toContain('const greeting');
  });
});

describe('useCodeDetection hook', () => {
  it('returns initial result synchronously', () => {
    const { result } = renderHook(() => useCodeDetection('const x = 1;'));
    expect(result.current.isCode).toBe(true);
  });

  it('updates when text changes', () => {
    const { result, rerender } = renderHook(({ text }) => useCodeDetection(text), {
      initialProps: { text: 'Hello' },
    });

    expect(result.current.isCode).toBe(false);

    rerender({ text: 'const app = new App();' });
    expect(result.current.isCode).toBe(true);
  });

  it('memoizes correctly on stable config', () => {
    const config = { minLength: 10, minMatches: 2 };

    const { result, rerender } = renderHook(({ text, cfg }) => useCodeDetection(text, cfg), {
      initialProps: { text: 'normal text', cfg: config },
    });

    const firstResult = result.current;

    rerender({ text: 'normal text', cfg: config });
    expect(result.current).toBe(firstResult); // same reference if nothing changed
  });
});

describe('useIsCode convenience hook', () => {
  it('returns only the boolean', () => {
    const { result } = renderHook(() => useIsCode('function test() {}'));
    expect(typeof result.current).toBe('boolean');
    expect(result.current).toBe(true);
  });
});

describe('useCodeStyling convenience hook', () => {
  it('returns styling and badge info', () => {
    const { result } = renderHook(() => useCodeStyling('```js\nconsole.log("hi")\n```'));

    expect(result.current.textareaStyles.className).toContain('font-mono');
    expect(result.current.textareaStyles.className).toContain('border-blue');
    expect(result.current.badge).not.toBeNull();
    expect(result.current.badge!.show).toBe(true);
  });

  it('returns default styling for non-code', () => {
    const { result } = renderHook(() => useCodeStyling('Just chatting'));
    expect(result.current.textareaStyles.className).toContain('font-sans');
    expect(result.current.badge).toBeNull();
  });
});

describe('Edge cases & robustness', () => {
  it('handles text with only whitespace', () => {
    const result = detectCode('\n\n   \t   \n\n');
    expect(result.isCode).toBe(false);
  });

  it('does not crash with special regex characters in input', () => {
    const dangerous = '.*+?^${}()|[]\\';
    expect(() => detectCode(dangerous)).not.toThrow();
  });

  it('correctly identifies mixed content', () => {
    const mixed = `Here's how you do it:

\`\`\`python
def hello():
    print("world")
\`\`\`

Pretty cool, right?`;

    const result = detectCode(mixed);
    expect(result.isCode).toBe(true);
    expect(result.segments.some((s) => s.type === 'code')).toBe(true);
  });
});
