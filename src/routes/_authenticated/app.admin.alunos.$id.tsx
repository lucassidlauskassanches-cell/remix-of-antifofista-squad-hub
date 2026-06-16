import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getStudentDetail,
  saveTrainingPlan,
  saveNutritionPlan,
  listGallery,
} from "@/lib/squad.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/alunos/$id")({
  component: AlunoEditor,
});

type Exercise = {
  id?: string;
  day_label: string;
  exercise_name: string;
  sets: string | null;
  reps: string | null;
  load: string | null;
  rest: string | null;
  notes: string | null;
  gallery_video_id: string | null;
  order_index: number;
};

type Item = {
  food_name: string;
  quantity: string | null;
  notes: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  order_index: number;
};
type Meal = {
  meal_name: string;
  meal_time: string | null;
  order_index: number;
  items: Item[];
};

function AlunoEditor() {
  const { id } = useParams({ from: "/_authenticated/app/admin/alunos/$id" });
  const getDetail = useServerFn(getStudentDetail);
  const getGallery = useServerFn(listGallery);

  const { data, refetch } = useQuery({
    queryKey: ["student", id],
    queryFn: () => getDetail({ data: { studentId: id } }),
  });
  const { data: gallery } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => getGallery(),
  });

  if (!data) return <p>Carregando...</p>;

  return (
    <div className="space-y-4">
      <Link to="/app/admin/alunos" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Link>
      <div>
        <h1 className="tactical-heading text-2xl">{data.profile?.full_name}</h1>
        <p className="text-sm text-muted-foreground">{data.profile?.email}</p>
      </div>

      <Tabs defaultValue="treino">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="treino" className="tactical-heading">TREINO</TabsTrigger>
          <TabsTrigger value="nutricao" className="tactical-heading">NUTRIÇÃO</TabsTrigger>
        </TabsList>
        <TabsContent value="treino" className="mt-4">
          <TrainingEditor
            studentId={id}
            initialPlan={data.trainingPlan}
            initialExercises={data.exercises as any}
            gallery={gallery?.items ?? []}
            onSaved={() => refetch()}
          />
        </TabsContent>
        <TabsContent value="nutricao" className="mt-4">
          <NutritionEditor
            studentId={id}
            initialPlan={data.nutritionPlan}
            initialMeals={data.meals as any}
            initialItems={data.items as any}
            onSaved={() => refetch()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TrainingEditor({
  studentId,
  initialPlan,
  initialExercises,
  gallery,
  onSaved,
}: {
  studentId: string;
  initialPlan: any;
  initialExercises: any[];
  gallery: Array<{ id: string; title: string; muscle_group: string }>;
  onSaved: () => void;
}) {
  const save = useServerFn(saveTrainingPlan);
  const [title, setTitle] = useState(initialPlan?.title ?? "Treino");
  const [active, setActive] = useState(initialPlan?.active ?? true);
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(initialPlan?.title ?? "Treino");
    setActive(initialPlan?.active ?? true);
    setExercises(initialExercises ?? []);
  }, [initialPlan?.id, initialExercises]);

  function update(i: number, patch: Partial<Exercise>) {
    setExercises((es) => es.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addRow() {
    setExercises((es) => [
      ...es,
      {
        day_label: es.at(-1)?.day_label ?? "TREINO A",
        exercise_name: "",
        sets: "",
        reps: "",
        load: "",
        rest: "",
        notes: "",
        gallery_video_id: null,
        order_index: es.length,
      },
    ]);
  }
  function remove(i: number) {
    setExercises((es) => es.filter((_, idx) => idx !== i));
  }
  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= exercises.length) return;
    const copy = [...exercises];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setExercises(copy);
  }

  async function submit() {
    setLoading(true);
    try {
      await save({
        data: {
          studentId,
          planId: initialPlan?.id,
          title,
          active,
          exercises: exercises.map((e, i) => ({ ...e, order_index: i })),
        },
      });
      toast.success("Treino salvo");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 items-end">
        <div className="col-span-2">
          <Label className="tactical-heading text-xs">TÍTULO</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Ativo
        </label>
      </div>

      <div className="space-y-2">
        {exercises.map((ex, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="DIA (ex: TREINO A — Peito)"
                value={ex.day_label}
                onChange={(e) => update(i, { day_label: e.target.value })}
              />
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)}>
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)}>
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(i)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Input
              placeholder="Exercício"
              value={ex.exercise_name}
              onChange={(e) => update(i, { exercise_name: e.target.value })}
            />
            <div className="grid grid-cols-4 gap-2">
              <Input
                placeholder="Séries"
                value={ex.sets ?? ""}
                onChange={(e) => update(i, { sets: e.target.value })}
              />
              <Input
                placeholder="Reps"
                value={ex.reps ?? ""}
                onChange={(e) => update(i, { reps: e.target.value })}
              />
              <Input
                placeholder="Carga"
                value={ex.load ?? ""}
                onChange={(e) => update(i, { load: e.target.value })}
              />
              <Input
                placeholder="Descanso"
                value={ex.rest ?? ""}
                onChange={(e) => update(i, { rest: e.target.value })}
              />
            </div>
            <Textarea
              placeholder="Observações / cadência / técnica"
              value={ex.notes ?? ""}
              onChange={(e) => update(i, { notes: e.target.value })}
            />
            <Select
              value={ex.gallery_video_id ?? "none"}
              onValueChange={(v) =>
                update(i, { gallery_video_id: v === "none" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Vídeo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— sem vídeo —</SelectItem>
                {gallery.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.muscle_group ? `[${g.muscle_group}] ` : ""}
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={addRow} variant="outline" className="flex-1">
          <Plus className="w-4 h-4 mr-1" /> Adicionar exercício
        </Button>
        <Button
          onClick={submit}
          disabled={loading}
          className="flex-1 tactical-heading bg-primary text-primary-foreground"
        >
          {loading ? "SALVANDO..." : "SALVAR TREINO"}
        </Button>
      </div>
    </div>
  );
}

function NutritionEditor({
  studentId,
  initialPlan,
  initialMeals,
  initialItems,
  onSaved,
}: {
  studentId: string;
  initialPlan: any;
  initialMeals: any[];
  initialItems: any[];
  onSaved: () => void;
}) {
  const save = useServerFn(saveNutritionPlan);
  const [title, setTitle] = useState(initialPlan?.title ?? "Plano nutricional");
  const [active, setActive] = useState(initialPlan?.active ?? true);
  const [generalNotes, setGeneralNotes] = useState(initialPlan?.general_notes ?? "");
  const [meals, setMeals] = useState<Meal[]>(() => buildMeals(initialMeals, initialItems));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(initialPlan?.title ?? "Plano nutricional");
    setActive(initialPlan?.active ?? true);
    setGeneralNotes(initialPlan?.general_notes ?? "");
    setMeals(buildMeals(initialMeals, initialItems));
  }, [initialPlan?.id, initialMeals, initialItems]);

  function addMeal() {
    setMeals((m) => [
      ...m,
      {
        meal_name: `REFEIÇÃO ${m.length + 1}`,
        meal_time: "",
        order_index: m.length,
        items: [],
      },
    ]);
  }
  function removeMeal(i: number) {
    setMeals((m) => m.filter((_, idx) => idx !== i));
  }
  function updateMeal(i: number, patch: Partial<Meal>) {
    setMeals((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addItem(mi: number) {
    setMeals((m) =>
      m.map((x, idx) =>
        idx === mi
          ? {
              ...x,
              items: [
                ...x.items,
                {
                  food_name: "",
                  quantity: "",
                  notes: "",
                  calories: null,
                  protein: null,
                  carbs: null,
                  fat: null,
                  order_index: x.items.length,
                },
              ],
            }
          : x,
      ),
    );
  }
  function updateItem(mi: number, ii: number, patch: Partial<Item>) {
    setMeals((m) =>
      m.map((x, idx) =>
        idx === mi
          ? {
              ...x,
              items: x.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)),
            }
          : x,
      ),
    );
  }
  function removeItem(mi: number, ii: number) {
    setMeals((m) =>
      m.map((x, idx) =>
        idx === mi
          ? { ...x, items: x.items.filter((_, j) => j !== ii) }
          : x,
      ),
    );
  }

  async function submit() {
    setLoading(true);
    try {
      await save({
        data: {
          studentId,
          planId: initialPlan?.id,
          title,
          active,
          general_notes: generalNotes,
          meals: meals.map((m, i) => ({
            ...m,
            order_index: i,
            items: m.items.map((it, j) => ({ ...it, order_index: j })),
          })),
        },
      });
      toast.success("Dieta salva");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 items-end">
        <div className="col-span-2">
          <Label className="tactical-heading text-xs">TÍTULO</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Ativo
        </label>
      </div>
      <div>
        <Label className="tactical-heading text-xs">ORIENTAÇÕES GERAIS</Label>
        <Textarea
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
          rows={3}
        />
      </div>

      {meals.map((meal, mi) => (
        <Card key={mi} className="p-3 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Nome (REFEIÇÃO 1 — Café)"
              value={meal.meal_name}
              onChange={(e) => updateMeal(mi, { meal_name: e.target.value })}
            />
            <Input
              placeholder="Horário"
              value={meal.meal_time ?? ""}
              onChange={(e) => updateMeal(mi, { meal_time: e.target.value })}
              className="w-28"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeMeal(mi)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2 pl-2 border-l-2 border-secondary">
            {meal.items.map((it, ii) => (
              <div key={ii} className="space-y-1">
                <div className="flex gap-2">
                  <Input
                    placeholder="Alimento"
                    value={it.food_name}
                    onChange={(e) =>
                      updateItem(mi, ii, { food_name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Qtd"
                    value={it.quantity ?? ""}
                    onChange={(e) =>
                      updateItem(mi, ii, { quantity: e.target.value })
                    }
                    className="w-24"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(mi, ii)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <Input
                    placeholder="kcal"
                    type="number"
                    value={it.calories ?? ""}
                    onChange={(e) =>
                      updateItem(mi, ii, {
                        calories: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <Input
                    placeholder="P"
                    type="number"
                    value={it.protein ?? ""}
                    onChange={(e) =>
                      updateItem(mi, ii, {
                        protein: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <Input
                    placeholder="C"
                    type="number"
                    value={it.carbs ?? ""}
                    onChange={(e) =>
                      updateItem(mi, ii, {
                        carbs: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <Input
                    placeholder="G"
                    type="number"
                    value={it.fat ?? ""}
                    onChange={(e) =>
                      updateItem(mi, ii, {
                        fat: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <Input
                  placeholder="Observações / substituições"
                  value={it.notes ?? ""}
                  onChange={(e) => updateItem(mi, ii, { notes: e.target.value })}
                />
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => addItem(mi)}
              className="w-full"
            >
              <Plus className="w-3 h-3 mr-1" /> Adicionar alimento
            </Button>
          </div>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button onClick={addMeal} variant="outline" className="flex-1">
          <Plus className="w-4 h-4 mr-1" /> Adicionar refeição
        </Button>
        <Button
          onClick={submit}
          disabled={loading}
          className="flex-1 tactical-heading bg-primary text-primary-foreground"
        >
          {loading ? "SALVANDO..." : "SALVAR DIETA"}
        </Button>
      </div>
    </div>
  );
}

function buildMeals(meals: any[] = [], items: any[] = []): Meal[] {
  return meals.map((m) => ({
    meal_name: m.meal_name,
    meal_time: m.meal_time,
    order_index: m.order_index,
    items: items
      .filter((it) => it.meal_id === m.id)
      .map((it) => ({
        food_name: it.food_name,
        quantity: it.quantity,
        notes: it.notes,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        order_index: it.order_index,
      })),
  }));
}
