
function LogbookReadOnly({
  rows,
}: {
  rows: Array<{ id: string; exercise: string; load: string; reps: string }>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-secondary/40 border-b border-border">
        <span className="tactical-heading text-[10px] tracking-widest text-primary">EXERCÍCIO</span>
        <span className="tactical-heading text-[10px] tracking-widest text-primary">CARGA</span>
        <span className="tactical-heading text-[10px] tracking-widest text-primary">REPS</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          O aluno ainda não registrou nenhuma linha.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-3 gap-2 px-3 py-2 text-sm">
              <span className="truncate">{r.exercise || "—"}</span>
              <span className="truncate">{r.load || "—"}</span>
              <span className="truncate">{r.reps || "—"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
        Apenas leitura. O aluno é quem edita o logbook.
      </p>
    </Card>
  );
}
