import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Pause, Play, Pencil, X, Check, RefreshCw, Layers } from 'lucide-react';

interface RetryPolicy {
  id: string;
  name: string;
}

interface Queue {
  id: string;
  name: string;
  priority: number;
  concurrency_limit: number;
  is_paused: boolean;
  retry_policy_id: string | null;
  created_at: string;
}

interface QueueStats {
  queued?: number;
  running?: number;
  claimed?: number;
  completed?: number;
  failed?: number;
  dead_letter?: number;
}

export default function Queues() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [stats, setStats] = useState<Record<string, QueueStats>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Queue>>({});
  const [saving, setSaving] = useState(false);

  const fetchQueues = async () => {
    setLoading(true);
    try {
      const res = await api.get('/queues?limit=50');
      const data: Queue[] = res.data.data;
      setQueues(data);
      // Fetch stats for each queue concurrently
      const statEntries = await Promise.all(
        data.map(async (q) => {
          try {
            const s = await api.get(`/queues/${q.id}/stats`);
            return [q.id, s.data] as [string, QueueStats];
          } catch {
            return [q.id, {}] as [string, QueueStats];
          }
        })
      );
      setStats(Object.fromEntries(statEntries));
    } catch (err) {
      console.error('Failed to fetch queues', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueues(); }, []);

  const handlePauseToggle = async (queue: Queue) => {
    try {
      await api.patch(`/queues/${queue.id}`, { is_paused: !queue.is_paused });
      setQueues(prev => prev.map(q => q.id === queue.id ? { ...q, is_paused: !q.is_paused } : q));
    } catch (err) {
      console.error('Failed to toggle pause', err);
    }
  };

  const startEdit = (queue: Queue) => {
    setEditingId(queue.id);
    setEditForm({ priority: queue.priority, concurrency_limit: queue.concurrency_limit });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (queueId: string) => {
    setSaving(true);
    try {
      const res = await api.patch(`/queues/${queueId}`, editForm);
      setQueues(prev => prev.map(q => q.id === queueId ? { ...q, ...res.data } : q));
      cancelEdit();
    } catch (err) {
      console.error('Failed to save queue', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black uppercase tracking-tight">Queue Management</h1>
        <Button onClick={fetchQueues} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center font-bold text-gray-400">Loading queues...</div>
      ) : queues.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="font-bold text-gray-500">No queues found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {queues.map((queue) => {
            const qStats = stats[queue.id] || {};
            const isEditing = editingId === queue.id;

            return (
              <Card key={queue.id} className="relative">
                <CardHeader className="border-b-2 border-black pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-xl">{queue.name}</CardTitle>
                      <p className="text-xs font-mono text-gray-400 mt-1">{queue.id.substring(0, 12)}...</p>
                    </div>
                    <Badge status={queue.is_paused ? 'paused' : 'running'}>
                      {queue.is_paused ? 'Paused' : 'Active'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-black uppercase mb-1">Priority</label>
                        <input
                          type="number"
                          className="w-full border-2 border-black rounded-brutal px-3 py-2 font-bold"
                          value={editForm.priority ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, priority: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase mb-1">Concurrency Limit</label>
                        <input
                          type="number"
                          className="w-full border-2 border-black rounded-brutal px-3 py-2 font-bold"
                          value={editForm.concurrency_limit ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, concurrency_limit: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => saveEdit(queue.id)} disabled={saving} className="gap-1">
                          <Check className="h-4 w-4" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="h-4 w-4" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/5 border-2 border-black rounded-brutal p-3">
                          <p className="text-xs font-black uppercase text-gray-500">Priority</p>
                          <p className="text-2xl font-black">{queue.priority}</p>
                        </div>
                        <div className="bg-black/5 border-2 border-black rounded-brutal p-3">
                          <p className="text-xs font-black uppercase text-gray-500">Concurrency</p>
                          <p className="text-2xl font-black">{queue.concurrency_limit}</p>
                        </div>
                      </div>

                      {/* Live Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Queued', key: 'queued', color: 'bg-status-queued' },
                          { label: 'Running', key: 'running', color: 'bg-status-running' },
                          { label: 'Done', key: 'completed', color: 'bg-status-success' },
                        ].map(({ label, key, color }) => (
                          <div key={key} className="text-center border-2 border-black rounded-brutal p-2">
                            <div className={`w-2 h-2 rounded-full ${color} mx-auto mb-1`} />
                            <p className="text-lg font-black">{(qStats as any)[key] || 0}</p>
                            <p className="text-xs font-bold text-gray-500 uppercase">{label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant={queue.is_paused ? 'default' : 'outline'}
                          onClick={() => handlePauseToggle(queue)}
                          className="gap-1 flex-1"
                        >
                          {queue.is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                          {queue.is_paused ? 'Resume' : 'Pause'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(queue)} className="gap-1">
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
