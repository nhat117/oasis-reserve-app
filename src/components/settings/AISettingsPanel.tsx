import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bot, Save, Loader2, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

interface AIConfig {
  id: string;
  ai_enabled: boolean;
  api_base_url: string;
  api_key_encrypted: string;
  model_name: string;
  embedding_model: string;
  system_prompt_override: string | null;
  max_tokens: number;
  temperature: number;
  handoff_keywords: string[];
  auto_handoff_on_negative_sentiment: boolean;
  chatwoot_base_url: string | null;
  chatwoot_api_token_encrypted: string | null;
  chatwoot_account_id: number | null;
}

export function AISettingsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['ai-config', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data as AIConfig | null;
    },
  });

  const [form, setForm] = useState({
    ai_enabled: true,
    api_base_url: 'https://api.openai.com/v1',
    api_key: '',
    model_name: 'gpt-4o-mini',
    embedding_model: 'text-embedding-3-small',
    system_prompt_override: '',
    max_tokens: 500,
    temperature: 0.7,
    handoff_keywords: 'speak to human, talk to staff, real person',
    auto_handoff_on_negative_sentiment: true,
    chatwoot_base_url: '',
    chatwoot_api_token: '',
    chatwoot_account_id: '',
    booking_mode: 'local' as 'local' | 'fresha',
    fresha_partner_token: '',
    fresha_location_id: '',
    fresha_api_base_url: 'https://partner-api.fresha.com/v1',
  });

  // Populate form from config
  useEffect(() => {
    if (config) {
      setForm({
        ai_enabled: config.ai_enabled,
        api_base_url: config.api_base_url || 'https://api.openai.com/v1',
        api_key: '', // never show the encrypted key
        model_name: config.model_name || 'gpt-4o-mini',
        embedding_model: config.embedding_model || 'text-embedding-3-small',
        system_prompt_override: config.system_prompt_override || '',
        max_tokens: config.max_tokens || 500,
        temperature: config.temperature || 0.7,
        handoff_keywords: config.handoff_keywords?.join(', ') || '',
        auto_handoff_on_negative_sentiment: config.auto_handoff_on_negative_sentiment,
        chatwoot_base_url: config.chatwoot_base_url || '',
        chatwoot_api_token: '', // never show
        chatwoot_account_id: config.chatwoot_account_id?.toString() || '',
        booking_mode: (config as any).booking_mode || 'local',
        fresha_partner_token: '', // never show
        fresha_location_id: (config as any).fresha_location_id || '',
        fresha_api_base_url: (config as any).fresha_api_base_url || 'https://partner-api.fresha.com/v1',
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        tenant_id: TENANT_ID,
        ai_enabled: form.ai_enabled,
        api_base_url: form.api_base_url.trim(),
        model_name: form.model_name.trim(),
        embedding_model: form.embedding_model.trim(),
        system_prompt_override: form.system_prompt_override.trim() || null,
        max_tokens: form.max_tokens,
        temperature: form.temperature,
        handoff_keywords: form.handoff_keywords.split(',').map((k) => k.trim()).filter(Boolean),
        auto_handoff_on_negative_sentiment: form.auto_handoff_on_negative_sentiment,
        chatwoot_base_url: form.chatwoot_base_url.trim() || null,
        chatwoot_account_id: form.chatwoot_account_id ? parseInt(form.chatwoot_account_id) : null,
        booking_mode: form.booking_mode,
        fresha_location_id: form.fresha_location_id.trim() || null,
        fresha_api_base_url: form.fresha_api_base_url.trim() || 'https://partner-api.fresha.com/v1',
        updated_at: new Date().toISOString(),
      };

      // Only update keys if user entered new values
      if (form.api_key.trim()) {
        payload.api_key_encrypted = form.api_key.trim();
      }
      if (form.chatwoot_api_token.trim()) {
        payload.chatwoot_api_token_encrypted = form.chatwoot_api_token.trim();
      }
      if (form.fresha_partner_token.trim()) {
        payload.fresha_partner_token_encrypted = form.fresha_partner_token.trim();
      }

      if (config?.id) {
        const { error } = await supabase.from('ai_config').update(payload).eq('id', config.id);
        if (error) throw error;
      } else {
        if (!form.api_key.trim()) throw new Error('API key is required for initial setup');
        payload.api_key_encrypted = form.api_key.trim();
        const { error } = await supabase.from('ai_config').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      toast({ title: 'Saved', description: 'AI settings updated.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    },
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(`${form.api_base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${form.api_key || 'saved-key'}`,
        },
        body: JSON.stringify({
          model: form.model_name,
          messages: [
            { role: 'system', content: 'Reply with: Connection successful!' },
            { role: 'user', content: 'Test' },
          ],
          max_tokens: 20,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setTestResult(`Connected! Response: ${data.choices?.[0]?.message?.content || 'OK'}`);
      } else {
        setTestResult(`Error: ${resp.status} ${resp.statusText}`);
      }
    } catch (err) {
      setTestResult(`Connection failed: ${err}`);
    }
    setTesting(false);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-4">Loading AI settings...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <h3 className="font-medium text-sm">AI Chat Assistant</h3>
          <Badge variant={form.ai_enabled ? 'default' : 'secondary'} className="text-xs">
            {form.ai_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Global AI</span>
          <Switch checked={form.ai_enabled} onCheckedChange={(v) => setForm({ ...form, ai_enabled: v })} />
        </div>
      </div>

      {/* API Configuration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">API Base URL</Label>
          <Input
            value={form.api_base_url}
            onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="h-9 text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Supports any OpenAI-compatible endpoint</p>
        </div>
        <div>
          <Label className="text-xs">API Key</Label>
          <Input
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder={config ? '••••••• (saved)' : 'sk-...'}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Model</Label>
          <Input
            value={form.model_name}
            onChange={(e) => setForm({ ...form, model_name: e.target.value })}
            placeholder="gpt-4o-mini"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Embedding Model</Label>
          <Input
            value={form.embedding_model}
            onChange={(e) => setForm({ ...form, embedding_model: e.target.value })}
            placeholder="text-embedding-3-small"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Max Tokens</Label>
          <Input
            type="number"
            value={form.max_tokens}
            onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) || 500 })}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Temperature ({form.temperature})</Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
            className="w-full mt-2"
          />
        </div>
      </div>

      {/* Chatwoot Configuration */}
      <div>
        <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Chatwoot Connection</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Chatwoot URL</Label>
            <Input
              value={form.chatwoot_base_url}
              onChange={(e) => setForm({ ...form, chatwoot_base_url: e.target.value })}
              placeholder="https://chatwoot.yourdomain.com"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">API Token</Label>
            <Input
              type="password"
              value={form.chatwoot_api_token}
              onChange={(e) => setForm({ ...form, chatwoot_api_token: e.target.value })}
              placeholder={config?.chatwoot_api_token_encrypted ? '••••••• (saved)' : 'Enter token'}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Account ID</Label>
            <Input
              value={form.chatwoot_account_id}
              onChange={(e) => setForm({ ...form, chatwoot_account_id: e.target.value })}
              placeholder="1"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Booking Mode */}
      <div>
        <h4 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Booking Mode</h4>
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setForm({ ...form, booking_mode: 'local' })}
            className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${form.booking_mode === 'local' ? 'border-blue-500 bg-blue-50' : 'border-[#E5E5E5] hover:border-[#CCC]'}`}
          >
            <p className="text-sm font-medium">Local (Oasis Reserve)</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">AI creates bookings directly in your database</p>
          </div>
          <div
            onClick={() => setForm({ ...form, booking_mode: 'fresha' })}
            className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${form.booking_mode === 'fresha' ? 'border-blue-500 bg-blue-50' : 'border-[#E5E5E5] hover:border-[#CCC]'}`}
          >
            <p className="text-sm font-medium">Fresha</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">AI creates bookings via Fresha Partner API</p>
          </div>
        </div>

        {form.booking_mode === 'fresha' && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <Label className="text-xs">Fresha API Base URL</Label>
              <Input
                value={form.fresha_api_base_url}
                onChange={(e) => setForm({ ...form, fresha_api_base_url: e.target.value })}
                placeholder="https://partner-api.fresha.com/v1"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Partner Token</Label>
              <Input
                type="password"
                value={form.fresha_partner_token}
                onChange={(e) => setForm({ ...form, fresha_partner_token: e.target.value })}
                placeholder={config ? '••••••• (saved)' : 'Enter token'}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Location ID</Label>
              <Input
                value={form.fresha_location_id}
                onChange={(e) => setForm({ ...form, fresha_location_id: e.target.value })}
                placeholder="loc_123"
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* System Prompt Override */}
      <div>
        <Label className="text-xs">Custom System Prompt (optional)</Label>
        <Textarea
          value={form.system_prompt_override}
          onChange={(e) => setForm({ ...form, system_prompt_override: e.target.value })}
          placeholder="Override the default AI personality. Leave blank to use the default prompt."
          className="min-h-[80px] text-sm"
        />
      </div>

      {/* Handoff Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Handoff Keywords (comma-separated)</Label>
          <Input
            value={form.handoff_keywords}
            onChange={(e) => setForm({ ...form, handoff_keywords: e.target.value })}
            placeholder="speak to human, talk to staff"
            className="h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch
            checked={form.auto_handoff_on_negative_sentiment}
            onCheckedChange={(v) => setForm({ ...form, auto_handoff_on_negative_sentiment: v })}
          />
          <span className="text-xs">Auto-handoff on negative sentiment</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save Settings
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing || !form.api_base_url}>
          {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TestTube className="h-4 w-4 mr-1" />}
          Test Connection
        </Button>
      </div>

      {testResult && (
        <div className={`text-xs p-2 rounded border ${testResult.startsWith('Connected') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {testResult}
        </div>
      )}
    </div>
  );
}
