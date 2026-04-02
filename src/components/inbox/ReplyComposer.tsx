import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface ReplyComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled: boolean;
}

export function ReplyComposer({ onSend, disabled }: ReplyComposerProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[#E5E5E5] p-3">
      <div className="flex gap-2 items-end">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
          className="min-h-[60px] max-h-[120px] resize-none text-sm"
          disabled={disabled || sending}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!message.trim() || disabled || sending}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        Sending a reply will disable AI auto-responses for this conversation
      </p>
    </div>
  );
}
