import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking CSS imports so Vitest doesn't try to parse them
vi.mock('\\.(css|less|scss|sass)$', () => ({}));
