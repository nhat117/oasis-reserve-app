import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Bot, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  platform: string;
  contact_name: string | null;
  contact_avatar_url: string | null;
  status: string;
  ai_enabled: boolean;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  platformFilter: string;
  onPlatformFilterChange: (val: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

const platformIcons: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  tiktok: '🎵',
  web: '🌐',
  api: '🔗',
};

const platformColors: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  tiktok: 'bg-gray-100 text-gray-700',
  web: 'bg-green-100 text-green-700',
  api: 'bg-purple-100 text-purple-700',
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  statusFilter,
  onStatusFilterChange,
  platformFilter,
  onPlatformFilterChange,
  searchQuery,
  onSearchChange,
}: ConversationListProps) {
  const filtered = conversations.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
    if (searchQuery && !c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full border-r border-[#E5E5E5]">
      {/* Filters */}
      <div className="p-3 space-y-2 border-b border-[#E5E5E5]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={onPlatformFilterChange}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="web">Web</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No conversations found
          </div>
        ) : (
          filtered.map((convo) => (
            <button
              key={convo.id}
              onClick={() => onSelect(convo.id)}
              className={cn(
                'w-full text-left p-3 border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors',
                selectedId === convo.id && 'bg-[#F0F0F0]',
              )}
            >
              <div className="flex items-start gap-2.5">
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-[#E5E5E5] flex items-center justify-center text-xs font-medium shrink-0">
                  {convo.contact_avatar_url ? (
                    <img src={convo.contact_avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    (convo.contact_name || '?')[0].toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium truncate">{convo.contact_name || 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: false })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-4', platformColors[convo.platform])}>
                      {platformIcons[convo.platform] || '🌐'} {convo.platform}
                    </Badge>
                    {convo.ai_enabled && (
                      <Bot className="h-3 w-3 text-blue-500" />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {convo.last_message_preview || 'No messages yet'}
                  </p>
                </div>

                {convo.unread_count > 0 && (
                  <Badge className="bg-blue-600 text-white text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full shrink-0">
                    {convo.unread_count}
                  </Badge>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
