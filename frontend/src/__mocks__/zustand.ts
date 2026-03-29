// __mocks__/zustand.ts
import { vi } from 'vitest';
import * as actualZustand from 'zustand';

const actualCreate = actualZustand.create;

export const create = (stateCreator: any) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getState();

  // Reset store to initial state after each test
  vi.afterEach(() => {
    store.setState(initialState, true);
  });

  return store;
};

// For compatibility with some setups
export const createStore = create;
