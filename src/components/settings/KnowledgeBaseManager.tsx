import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, BookOpen, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TENANT_ID = import.meta.env.VITE_TENANT_ID;
const CATEGORIES = ['faq', 'services', 'pricing', 'policies', 'general'] as const;

interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function KnowledgeBaseManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState({ title: '', content: '', category: 'general' });

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['knowledge-base', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as KBArticle[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (article: { title: string; content: string; category: string; id?: string }) => {
      let articleId = article.id;

      if (articleId) {
        const { error } = await supabase
          .from('knowledge_base')
          .update({ title: article.title, content: article.content, category: article.category, updated_at: new Date().toISOString() })
          .eq('id', articleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('knowledge_base')
          .insert({ tenant_id: TENANT_ID, title: article.title, content: article.content, category: article.category })
          .select('id')
          .single();
        if (error) throw error;
        articleId = data.id;
      }

      // Trigger embedding generation
      await supabase.functions.invoke('ai-embed-text', {
        body: { text: `${article.title}\n\n${article.content}`, knowledge_base_id: articleId, tenant_id: TENANT_ID },
      });

      return articleId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      setDialogOpen(false);
      setEditingArticle(null);
      setForm({ title: '', content: '', category: 'general' });
      toast({ title: 'Saved', description: 'Article saved and embeddings updated.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast({ title: 'Deleted' });
    },
  });

  const openCreate = () => {
    setEditingArticle(null);
    setForm({ title: '', content: '', category: 'general' });
    setDialogOpen(true);
  };

  const openEdit = (article: KBArticle) => {
    setEditingArticle(article);
    setForm({ title: article.title, content: article.content, category: article.category });
    setDialogOpen(true);
  };

  const filtered = categoryFilter === 'all' ? articles : articles.filter((a) => a.category === categoryFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <h3 className="font-medium text-sm">Knowledge Base</h3>
          <Badge variant="secondary" className="text-xs">{articles.length} articles</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Article
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No knowledge base articles yet. Add articles about your services, FAQs, and policies so the AI can answer customer questions.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium text-sm">{article.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{article.category}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(article.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(article)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteMutation.mutate(article.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Edit Article' : 'New Article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., What are your opening hours?" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Content</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Write the answer or information here..."
                className="min-h-[160px]"
              />
            </div>
            <Button
              className="w-full"
              disabled={!form.title.trim() || !form.content.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ ...form, id: editingArticle?.id })}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingArticle ? 'Update & Re-embed' : 'Save & Generate Embeddings'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
