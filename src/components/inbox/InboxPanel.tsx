import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { ReplyComposer } from './ReplyComposer';
import { HumanTakeoverControls } from './HumanTakeoverControls';
import { MessageSquare } from 'lucide-react';

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

export function InboxPanel() {
  const queryClient = useQueryClient();
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  const { data: conversations = [], isLoading: convosLoading } = useQuery({
    queryKey: ['inbox-conversations', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ['inbox-messages', selectedConvoId],
    queryFn: async () => {
      if (!selectedConvoId) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConvoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // metadata is stored as jsonb (always an object or null in practice);
      // the generated Json type is a wider union than MessageThread expects.
      return (data || []) as unknown as Array<typeof data[number] & { metadata: Record<string, unknown> | null }>;
    },
    enabled: !!selectedConvoId,
  });

  // Fetch staff members for assignment — user_roles has no email column, so
  // real emails come from Supabase Auth via the manage-admins edge function
  // (same source AdminDashboard.tsx's account management uses).
  const { data: staffMembers = [] } = useQuery({
    queryKey: ['inbox-staff', TENANT_ID],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return [];
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admins`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to load staff members');
      const admins = result.admins as { id: string; email: string; role: string }[];
      return admins.map(a => ({ user_id: a.id, email: a.email, role: a.role }));
    },
  });

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId);

  // Realtime subscriptions
  useEffect(() => {
    const convoChannel = supabase
      .channel('inbox-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
        },
      )
      .subscribe();

    const msgChannel = supabase
      .channel('inbox-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as { conversation_id: string };
          if (newMsg.conversation_id === selectedConvoId) {
            queryClient.invalidateQueries({ queryKey: ['inbox-messages', selectedConvoId] });
          }
          queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convoChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [queryClient, selectedConvoId]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (!selectedConvoId) return;
    const convo = conversations.find((c) => c.id === selectedConvoId);
    if (convo && convo.unread_count > 0) {
      supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', selectedConvoId)
        .then();
    }
  }, [selectedConvoId, conversations]);

  // Toggle AI
  const toggleAIMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ ai_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] }),
  });

  // Assign staff
  const assignMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string | null }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] }),
  });

  // Send staff reply
  const handleSendReply = useCallback(async (content: string) => {
    if (!selectedConvo) return;

    // 1. Insert message into DB
    const { error: msgErr } = await supabase.from('chat_messages').insert({
      tenant_id: TENANT_ID,
      conversation_id: selectedConvo.id,
      direction: 'outbound',
      sender_type: 'staff',
      sender_name: 'Staff',
      content,
      content_type: 'text',
    });
    if (msgErr) throw msgErr;

    // 2. Disable AI (human takeover)
    await supabase
      .from('conversations')
      .update({
        ai_enabled: false,
        last_message_at: new Date().toISOString(),
        last_message_preview: content.slice(0, 200),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedConvo.id);

    // 3. Send via Sinch
    if (selectedConvo.external_conversation_id) {
      await supabase.functions.invoke('sinch-send-message', {
        body: {
          external_conversation_id: selectedConvo.external_conversation_id,
          content,
          tenant_id: TENANT_ID,
        },
      });
    }

    // 4. Refresh
    queryClient.invalidateQueries({ queryKey: ['inbox-messages', selectedConvo.id] });
    queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
  }, [selectedConvo, queryClient]);

  return (
    <div className="bg-white rounded-lg border border-[#E5E5E5] overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
      <div className="flex h-full">
        {/* Left: Conversation List */}
        <div className="w-[340px] shrink-0">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvoId}
            onSelect={setSelectedConvoId}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            platformFilter={platformFilter}
            onPlatformFilterChange={setPlatformFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Right: Message Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConvo ? (
            <>
              <HumanTakeoverControls
                aiEnabled={selectedConvo.ai_enabled}
                onToggleAI={(enabled) => toggleAIMutation.mutate({ id: selectedConvo.id, enabled })}
                assignedTo={selectedConvo.assigned_to}
                onAssign={(userId) => assignMutation.mutate({ id: selectedConvo.id, userId })}
                staffMembers={staffMembers}
                platform={selectedConvo.platform}
                status={selectedConvo.status}
                contactName={selectedConvo.contact_name || 'Unknown'}
              />
              <MessageThread messages={messages} isLoading={msgsLoading} />
              <ReplyComposer onSend={handleSendReply} disabled={false} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to view messages</p>
              {convosLoading && <p className="text-xs mt-1">Loading conversations...</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
