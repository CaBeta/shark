import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UseInvokeResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: Record<string, unknown>[]) => Promise<T>;
}

export function useInvoke<T>(command: string): UseInvokeResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: Record<string, unknown>[]): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        // Merge all arg objects into a single params object
        const params = args.reduce<Record<string, unknown>>((acc, arg) => {
          return { ...acc, ...arg };
        }, {});
        const result = await invoke<T>(command, params);
        setData(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [command],
  );

  return { data, loading, error, execute };
}
