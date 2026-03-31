import { useState, useEffect, useCallback, useRef } from 'react';

interface SquarePaymentsConfig {
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

interface UseSquarePaymentsReturn {
  ready: boolean;
  loading: boolean;
  error: string | null;
  cardRef: React.MutableRefObject<any>;
  attachCard: (containerId: string) => Promise<void>;
  tokenizeCard: () => Promise<string | null>;
  detachCard: () => void;
}

const SANDBOX_SDK_URL = 'https://sandbox.web.squarecdn.com/v1/square.js';
const PRODUCTION_SDK_URL = 'https://web.squarecdn.com/v1/square.js';

function loadSquareScript(environment: 'sandbox' | 'production'): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = environment === 'production' ? PRODUCTION_SDK_URL : SANDBOX_SDK_URL;

    // Check if already loaded
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      if ((window as any).Square) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Square SDK')));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Square SDK'));
    document.head.appendChild(script);
  });
}

export function useSquarePayments(config: SquarePaymentsConfig | null): UseSquarePaymentsReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentsRef = useRef<any>(null);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    if (!config?.applicationId || !config?.locationId) return;

    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);

      try {
        await loadSquareScript(config!.environment);

        const Square = (window as any).Square;
        if (!Square) {
          throw new Error('Square SDK not available');
        }

        const payments = Square.payments(config!.applicationId, config!.locationId);
        paymentsRef.current = payments;

        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Square');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [config?.applicationId, config?.locationId, config?.environment]);

  const attachCard = useCallback(async (containerId: string) => {
    if (!paymentsRef.current) throw new Error('Square payments not initialized');

    // Detach existing card if any
    if (cardRef.current) {
      try { await cardRef.current.destroy(); } catch {}
      cardRef.current = null;
    }

    const card = await paymentsRef.current.card();
    await card.attach(`#${containerId}`);
    cardRef.current = card;
  }, []);

  const tokenizeCard = useCallback(async (): Promise<string | null> => {
    if (!cardRef.current) {
      setError('Card form not attached');
      return null;
    }

    try {
      const result = await cardRef.current.tokenize();
      if (result.status === 'OK') {
        return result.token;
      } else {
        const errorMessages = result.errors?.map((e: any) => e.message).join(', ') || 'Tokenization failed';
        setError(errorMessages);
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tokenization failed');
      return null;
    }
  }, []);

  const detachCard = useCallback(() => {
    if (cardRef.current) {
      try { cardRef.current.destroy(); } catch {}
      cardRef.current = null;
    }
  }, []);

  return { ready, loading, error, cardRef, attachCard, tokenizeCard, detachCard };
}
