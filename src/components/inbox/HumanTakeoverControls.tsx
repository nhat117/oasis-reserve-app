import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bot, User } from 'lucide-react';

interface HumanTakeoverControlsProps {
  aiEnabled: boolean;
  onToggleAI: (enabled: boolean) => void;
  assignedTo: string | null;
  onAssign: (userId: string | null) => void;
  staffMembers: Array<{ user_id: string; email: string; role: string }>;
  platform: string;
  status: string;
  contactName: string;
}

const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  web: 'Web',
  api: 'API',
};

export function HumanTakeoverControls({
  aiEnabled,
  onToggleAI,
  assignedTo,
  onAssign,
  staffMembers,
  platform,
  status,
  contactName,
}: HumanTakeoverControlsProps) {
  return (
    <div className="border-b border-[#E5E5E5] px-4 py-2.5 flex items-center justify-between gap-3 bg-white">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="font-medium text-sm truncate">{contactName}</h3>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {platformLabels[platform] || platform}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[10px] shrink-0 ${
            status === 'open' ? 'bg-green-50 text-green-700' :
            status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
            'bg-gray-50 text-gray-500'
          }`}
        >
          {status}
        </Badge>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* AI Toggle */}
        <div className="flex items-center gap-1.5">
          {aiEnabled ? (
            <Bot className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <User className="h-3.5 w-3.5 text-amber-600" />
          )}
          <span className="text-xs text-muted-foreground">
            {aiEnabled ? 'AI Active' : 'Manual'}
          </span>
          <Switch
            checked={aiEnabled}
            onCheckedChange={onToggleAI}
            className="scale-75"
          />
        </div>

        {/* Assign to staff */}
        <Select
          value={assignedTo || 'unassigned'}
          onValueChange={(val) => onAssign(val === 'unassigned' ? null : val)}
        >
          <SelectTrigger className="h-7 text-xs w-[140px]">
            <SelectValue placeholder="Assign to..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {staffMembers.map((s) => (
              <SelectItem key={s.user_id} value={s.user_id}>
                {s.email.split('@')[0]} ({s.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
