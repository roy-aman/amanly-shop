// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) on Vitest's
// `expect` and augments its types. Imported by every test via vitest setupFiles.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// We run with `globals: false`, so Testing Library's automatic per-test cleanup
// (which hooks a global afterEach) is NOT registered — do it explicitly, otherwise
// rendered DOM leaks across tests and queries find duplicate elements.
afterEach(() => {
  cleanup();
});
