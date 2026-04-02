import { useEffect, useRef } from 'react';
import { Bot, User, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  direction: string;
  sender_type: string;
  sender_name: string | null;
  content: string;
  content_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface MessageThreadProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading messages...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No messages yet
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => {
        const isCustomer = msg.sender_type === 'customer';
        const isAI = msg.sender_type === 'ai';
        const isStaff = msg.sender_type === 'staff';

        return (
          <div
            key={msg.id}
            className={cn('flex gap-2', !isCustomer && 'justify-end')}
          >
            {isCustomer && (
              <div className="h-7 w-7 rounded-full bg-[#E5E5E5] flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
            )}

            <div
              className={cn(
                'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                isCustomer && 'bg-white border border-[#E5E5E5]',
                isAI && 'bg-blue-50 border border-blue-100',
                isStaff && 'bg-amber-50 border border-amber-100',
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {isAI && <Bot className="h-3 w-3 text-blue-500" />}
                {isStaff && <Headphones className="h-3 w-3 text-amber-600" />}
                <span className="text-[10px] font-medium text-muted-foreground">
                  {msg.sender_name || msg.sender_type}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(msg.created_at), 'HH:mm')}
                </span>
              </div>

              <p className="whitespace-pre-wrap break-words">{msg.content}</p>

              {/* Tool call results */}
              {msg.metadata && renderToolResults(msg.metadata)}
            </div>

            {!isCustomer && (
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                  isAI ? 'bg-blue-100' : 'bg-amber-100',
                )}
              >
                {isAI ? <Bot className="h-3.5 w-3.5 text-blue-600" /> : <Headphones className="h-3.5 w-3.5 text-amber-600" />}
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function renderToolResults(metadata: Record<string, unknown>) {
  // Show booking confirmations or availability results as cards
  if (!metadata || typeof metadata !== 'object') return null;

  const toolCalls = metadata.tool_calls as Array<{
    name: string;
    result: Record<string, unknown>;
  }> | undefined;

  if (!toolCalls?.length) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {toolCalls.map((tc, i) => (
        <div key={i} className="bg-white/60 rounded border border-dashed border-[#E5E5E5] p-2 text-xs">
          <span className="font-medium text-muted-foreground">
            {tc.name === 'create_booking' && 'Booking Created'}
            {tc.name === 'check_availability' && 'Availability Checked'}
            {tc.name === 'transfer_to_human' && 'Transferred to Staff'}
            {!['create_booking', 'check_availability', 'transfer_to_human'].includes(tc.name) && tc.name}
          </span>
        </div>
      ))}
    </div>
  );
}
