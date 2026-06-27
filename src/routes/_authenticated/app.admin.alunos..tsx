
function DietSection({ studentId }: { studentId: string }) {
  const fetchDiet = useServerFn(getStudentDiet);
  const { data, refetch } = useQuery({
    queryKey: ["student-diet", studentId],
    queryFn: () => fetchDiet({ data: { studentId } }),
  });
  return (
    <DietUploader
      studentId={studentId}
      current={(data as any) ?? null}
      onChanged={() => refetch()}
    />
  );
}
