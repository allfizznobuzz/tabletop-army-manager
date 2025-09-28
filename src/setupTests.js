// CRA Jest setup
import "@testing-library/jest-dom";

// Polyfill ResizeObserver for JSDOM
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserver;
  global.ResizeObserver = ResizeObserver;
}

// Polyfill matchMedia if missing
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  });
}

// Polyfill requestAnimationFrame/cancelAnimationFrame
if (typeof global.requestAnimationFrame !== "function") {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
}

// Safe stub for scrollIntoView in JSDOM
if (!Element.prototype.scrollIntoView) {
  // eslint-disable-next-line no-extend-native
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Global mocks for @dnd-kit to avoid ESM/transform issues in tests
jest.mock("@dnd-kit/core", () => ({
  __esModule: true,
  DndContext: ({ children }) => children,
  closestCenter: jest.fn(),
  PointerSensor: function PointerSensor() {},
  useSensor: jest.fn(() => ({})),
  useSensors: jest.fn((...args) => args),
  DragOverlay: ({ children }) => children,
}));

jest.mock("@dnd-kit/modifiers", () => ({
  __esModule: true,
  restrictToVerticalAxis: jest.fn(),
  restrictToFirstScrollableAncestor: jest.fn(),
}));

jest.mock("@dnd-kit/sortable", () => ({
  __esModule: true,
  SortableContext: ({ children }) => children,
  verticalListSortingStrategy: jest.fn(),
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  })),
  arrayMove: (arr) => arr,
}));

jest.mock("@dnd-kit/utilities", () => ({
  __esModule: true,
  CSS: { Transform: { toString: () => "" } },
}));
