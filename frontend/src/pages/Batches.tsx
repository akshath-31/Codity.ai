import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { RefreshCw, Layers, ChevronDown, ChevronUp } from 'lucide-react';

interface BatchJob {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  attempt_count: number;
  created_at: string;
  queue_id: string;
}

interface Batch {
  id: string;
  name: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  queue_id: string;
  created_at: string;
  job_stats?: Record<string, number>;
  jobs?: BatchJob[];
}

// Map batch status strings to badge status props
const batchBadgeStatus: Record<string, any> = {
  pending: 'queued',
  in_progress: 'running',
  completed: 'completed',
  partially_failed: 'failed',
  failed: 'dead_letter',
};

function ProgressBar({ batch }: { batch: Batch }) {
  const total = batch.total_jobs || 0;
  const stats = batch.job_stats || {};
  const completed = stats['completed'] || 0;
  const failed = (stats['failed'] || 0) + (stats['dead_letter'] || 0);
  const running = (stats['running'] || 0) + (stats['claimed'] || 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-xs font-bold mb-1">
        <span>{completed}/{total} completed</span>
        {failed > 0 && <span className="text-status-failed">{failed} failed</span>}
      </div>
      <div className="h-4 border-2 border-black rounded-brutal overflow-hidden bg-white">
        <div className="h-full flex">
          <div className="bg-status-success transition-all" style={{ width: `${pct}%` }} />
          {running > 0 && (
            <div className="bg-status-running transition-all" style={{ width: `${Math.round((running / total) * 100)}%` }} />
          )}
          {failed > 0 && (
            <div className="bg-status-failed transition-all" style={{ width: `${Math.round((failed / total) * 100)}%` }} />
          )}
        </div>
      </div>
    </div>
  );
}

function BatchJobRow({ job }: { job: BatchJob }) {
  return (
    <div className="flex items-center gap-4 py-2 px-3 border-b border-black/10 last:border-0 hover:bg-black/5 rounded transition-colors">
      <span className="font-mono text-xs text-gray-400 w-24 shrink-0">{job.id.substring(0, 8)}...</span>
      <span className="font-bold text-sm flex-1">{job.job_type}</span>
      <Badge status={job.status as any}>{job.status.replace('_', ' ')}</Badge>
      <span className="text-xs text-gray-500 font-bold w-20 shrink-0 text-right">{job.attempt_count} attempts</span>
    </div>
  );
}

export default function Batches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<Record<string, { jobs: BatchJob[]; job_stats: Record<string, number> }>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/batches?limit=50');
      setBatches(res.data.data);
    } catch (err) {
      console.error('Failed to fetch batches', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBatches(); }, []);

  const toggleExpand = async (batchId: string) => {
    if (expandedId === batchId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(batchId);
    if (detailData[batchId]) return; // already loaded

    setLoadingDetail(batchId);
    try {
      const res = await api.get(`/batches/${batchId}`);
      setDetailData(prev => ({
        ...prev,
        [batchId]: { jobs: res.data.jobs || [], job_stats: res.data.job_stats || {} },
      }));
      // Also update the batch stats in the list
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, job_stats: res.data.job_stats } : b));
    } catch (err) {
      console.error('Failed to fetch batch detail', err);
    } finally {
      setLoadingDetail(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black uppercase tracking-tight">Batch Operations</h1>
        <Button onClick={fetchBatches} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center font-bold text-gray-400">Loading batches...</div>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="font-bold text-gray-500">No batches found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const isExpanded = expandedId === batch.id;
            const detail = detailData[batch.id];
            const statsToUse = batch.job_stats || {};
            const displayBatch = { ...batch, job_stats: statsToUse };

            return (
              <Card key={batch.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-black text-xl">{batch.name}</h3>
                      <p className="font-mono text-xs text-gray-400">{batch.id.substring(0, 16)}...</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(batch.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge status={batchBadgeStatus[batch.status] ?? 'default'}>
                        {batch.status.replace('_', ' ')}
                      </Badge>
                      <span className="font-bold text-sm bg-black/5 border-2 border-black rounded-brutal px-2 py-1">
                        {batch.total_jobs} jobs
                      </span>
                    </div>
                  </div>

                  <ProgressBar batch={displayBatch} />

                  <div className="mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 w-full justify-center border border-black/20"
                      onClick={() => toggleExpand(batch.id)}
                    >
                      {loadingDetail === batch.id ? (
                        'Loading jobs...'
                      ) : isExpanded ? (
                        <><ChevronUp className="h-4 w-4" /> Hide Jobs</>
                      ) : (
                        <><ChevronDown className="h-4 w-4" /> Show Jobs</>
                      )}
                    </Button>
                  </div>

                  {isExpanded && detail && (
                    <div className="mt-4 border-2 border-black rounded-brutal overflow-hidden bg-white">
                      {detail.jobs.length === 0 ? (
                        <p className="p-4 text-center font-bold text-gray-500">No jobs in this batch.</p>
                      ) : (
                        detail.jobs.map(job => <BatchJobRow key={job.id} job={job} />)
                      )}
                    </div>
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
