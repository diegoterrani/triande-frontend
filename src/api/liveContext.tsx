import { createContext } from 'react';

/** Bumped after each successful dashboard refresh so screens refetch their own endpoints. */
export const LiveRevisionContext = createContext(0);
