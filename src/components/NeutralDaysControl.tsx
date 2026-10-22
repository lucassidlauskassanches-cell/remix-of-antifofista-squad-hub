import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { CalendarDays, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { getNeutralDays, setNeutralDays } from '@/lib/registro.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NeutralDaysControl({ studentId, today, onSaved }: { studentId?: string; today: string; onSaved?: () => void }) {
  const qc = useQueryClient();
  const getDays = useServerFn(getNeutralDays);
  const save = useServerFn(setNeutralDays);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const key = ['neutral-days', studentId ?? 'me'];
  const query = useQuery({ queryKey: key, queryFn: () => getDays({ data: { studentId } }) });
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => save({ data: { studentId, startDate: start, endDate: end, enabled } }),
    onSuccess: (result) => {
      qc.setQueryData(key, result);
      void qc.invalidateQueries({ queryKey: ['registro'] });
      void qc.invalidateQueries({ queryKey: ['student-adherence'] });
      onSaved?.();
      toast.success('Período atualizado');
    },
    onError: (error) => toast.error(error.message),
  });
  const days = query.data?.days ?? [];
  const periods: { start: string; end: string }[] = [];
  for (const day of days) {
    const last = periods[periods.length - 1];
    if (last && Date.parse(`${day.log_date}T00:00:00Z`) - Date.parse(`${last.end}T00:00:00Z`) === 86400000) last.end = day.log_date;
    else periods.push({ start: day.log_date, end: day.log_date });
  }
  const fmt = (date: string) => date.split('-').reverse().join('/');
  return <section className="space-y-3 border-y border-border py-4">
    <h2 className="tactical-heading text-sm flex items-center gap-2"><CalendarDays className="size-4 text-primary" /> VIAGEM / DESCANSO</h2>
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1"><Label htmlFor={`neutral-start-${studentId ?? 'me'}`}>De</Label><Input id={`neutral-start-${studentId ?? 'me'}`} type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor={`neutral-end-${studentId ?? 'me'}`}>Até</Label><Input id={`neutral-end-${studentId ?? 'me'}`} type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} /></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={mutation.isPending || !start || !end} onClick={() => mutation.mutate(true)}><Check className="size-4 mr-1" /> Marcar período</Button>
      <Button variant="ghost" size="sm" disabled={mutation.isPending || !start || !end} onClick={() => mutation.mutate(false)}><X className="size-4 mr-1" /> Desmarcar período</Button>
    </div>
    {periods.map(p => <p key={p.start} className="text-xs text-primary">{fmt(p.start)}{p.end !== p.start ? ` — ${fmt(p.end)}` : ''} · Dias neutros</p>)}
  </section>;
}