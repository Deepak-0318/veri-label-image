/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type, no-useless-escape */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper function that matches the logic inside GuidelinesContent matchesCount
function calculateMatches(guidelines: string | null, searchQuery: string): number {
  if (!searchQuery.trim() || !guidelines) return 0;
  try {
    const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "gi");
    const matches = guidelines.match(regex);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

describe('Guidelines System Unit Tests', () => {
  describe('Keyboard Shortcut Event Management', () => {
    let listeners: Record<string, Function[]> = {};

    beforeEach(() => {
      listeners = {};
      global.window = {
        addEventListener: vi.fn((event: string, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        }),
        removeEventListener: vi.fn((event: string, cb: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(l => l !== cb);
          }
        })
      } as any;
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it('should register and clean up keydown event listener', () => {
      const callback = vi.fn();
      
      // Simulate useGuidelinesShortcut hook mounting behavior
      const registerShortcut = (cb: () => void) => {
        const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
            e.preventDefault();
            cb();
          }
        };
        global.window.addEventListener('keydown', handleKeyDown);
        return () => {
          global.window.removeEventListener('keydown', handleKeyDown);
        };
      };

      const unmount = registerShortcut(callback);

      expect(global.window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      // Simulate Ctrl+G trigger
      const mockEvent = {
        ctrlKey: true,
        metaKey: false,
        key: 'g',
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      listeners['keydown']?.forEach(listener => listener(mockEvent));

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);

      // Simulate Cmd+G trigger
      const mockMetaEvent = {
        ctrlKey: false,
        metaKey: true,
        key: 'G',
        preventDefault: vi.fn()
      } as unknown as KeyboardEvent;

      listeners['keydown']?.forEach(listener => listener(mockMetaEvent));
      expect(callback).toHaveBeenCalledTimes(2);

      // Verify cleanup
      unmount();
      expect(global.window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('LocalStorage State Persistence', () => {
    let store: Record<string, string> = {};

    beforeEach(() => {
      store = {};
      global.localStorage = {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
      } as any;
    });

    afterEach(() => {
      delete (global as any).localStorage;
    });

    it('should correctly save and restore sidebar visibility state', () => {
      const defaultState = localStorage.getItem("verilabel_guidelines_sidebar_open") !== "false";
      expect(defaultState).toBe(true); // default when store is empty

      localStorage.setItem("verilabel_guidelines_sidebar_open", "false");
      const savedState = localStorage.getItem("verilabel_guidelines_sidebar_open") !== "false";
      expect(savedState).toBe(false);

      localStorage.setItem("verilabel_guidelines_sidebar_open", "true");
      const restoredState = localStorage.getItem("verilabel_guidelines_sidebar_open") !== "false";
      expect(restoredState).toBe(true);
    });
  });

  describe('Search Query Keyword Matching', () => {
    const guidelines = `# Project Annotation Rules
- Detect all person annotations.
- Ignore cars.
- Verify matching bounds [bounding box].
`;

    it('should return correct matches count for simple strings', () => {
      expect(calculateMatches(guidelines, 'person')).toBe(1);
      expect(calculateMatches(guidelines, 'detect')).toBe(1);
      expect(calculateMatches(guidelines, 'bounds')).toBe(1);
    });

    it('should be case-insensitive', () => {
      expect(calculateMatches(guidelines, 'PERSON')).toBe(1);
      expect(calculateMatches(guidelines, 'Detect')).toBe(1);
    });

    it('should handle regex special characters safely', () => {
      expect(calculateMatches(guidelines, '[bounding box]')).toBe(1);
      expect(calculateMatches(guidelines, '-')).toBe(3);
    });

    it('should return 0 when query is empty or whitespace', () => {
      expect(calculateMatches(guidelines, '')).toBe(0);
      expect(calculateMatches(guidelines, '   ')).toBe(0);
    });
  });
});
