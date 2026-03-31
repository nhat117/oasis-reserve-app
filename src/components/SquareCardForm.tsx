import { useEffect, useState, useRef } from 'react';
import { useSquarePayments } from '@/hooks/useSquarePayments';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Smartphone, AlertCircle } from 'lucide-react';

interface SquareCardFormProps {
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
  amount: number;
  onTokenize: (nonce: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  labels?: {
    pay?: string;
    cancel?: string;
    loading?: string;
    processing?: string;
    enterCard?: string;
    tapToPay?: string;
  };
}

export function SquareCardForm({
  applicationId,
  locationId,
  environment,
  amount,
  onTokenize,
  onCancel,
  disabled = false,
  labels = {},
}: SquareCardFormProps) {
  const config = applicationId && locationId
    ? { applicationId, locationId, environment }
    : null;

  const { ready, loading, error, attachCard, tokenizeCard, detachCard } = useSquarePayments(config);
  const [cardAttached, setCardAttached] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = 'sq-card-container';

  useEffect(() => {
    if (ready && !cardAttached) {
      attachCard(containerId)
        .then(() => setCardAttached(true))
        .catch(err => setLocalError(err.message));
    }
    return () => {
      detachCard();
      setCardAttached(false);
    };
  }, [ready]);

  const handlePay = async () => {
    setLocalError(null);
    setProcessing(true);
    try {
      const nonce = await tokenizeCard();
      if (nonce) {
        onTokenize(nonce);
      } else {
        setProcessing(false);
      }
    } catch {
      setLocalError('Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  const displayError = localError || error;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">{labels.loading || 'Loading payment form...'}</span>
      </div>
    );
  }

  if (!applicationId || !locationId) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Square Application ID and Location ID are required. Configure them in Settings.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tap-to-Pay / Contactless indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Smartphone className="h-3.5 w-3.5" />
        <span>{labels.tapToPay || 'Card, Apple Pay & Google Pay accepted'}</span>
      </div>

      {/* Square Card Input */}
      <div className="rounded-lg border border-border bg-white p-3">
        <div
          id={containerId}
          ref={containerRef}
          style={{ minHeight: 50 }}
        />
      </div>

      {/* Error display */}
      {displayError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={handlePay}
          disabled={disabled || processing || !cardAttached}
        >
          {processing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{labels.processing || 'Processing...'}</>
          ) : (
            <><CreditCard className="h-4 w-4 mr-2" />{labels.pay || `Pay $${amount.toFixed(2)}`}</>
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={processing}>
          {labels.cancel || 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
