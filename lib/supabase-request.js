// Retry reads once. A timed-out write can already have reached Supabase.
export function createSupabaseFetch(fetcher = fetch) {
  return async (input, init = {}) => {
    const method = String(init.method ?? input?.method ?? 'GET').toUpperCase();
    const callerSignal = init.signal ?? input?.signal;
    const attempts = method === 'GET' ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const timeout = AbortSignal.timeout(5000);
      const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
      try {
        const response = await fetcher(input, { ...init, signal });
        if (attempt + 1 === attempts || ![502, 503, 504].includes(response.status)) return response;
        await response.body?.cancel();
      } catch (error) {
        if (callerSignal?.aborted || attempt + 1 === attempts) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  };
}

export const accountServiceUnavailable = 'Could not reach the HRIS account service. Wait a moment and try again.';
