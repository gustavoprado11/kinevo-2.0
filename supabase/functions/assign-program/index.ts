import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Validate JWT manually
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Missing authorization" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        const token = authHeader.slice(7);

        // User client (for auth only)
        const supabaseUser = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Service role client (bypasses RLS)
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 2. Parse body
        const body = await req.json();
        const { studentId, templateId, startDate, isScheduled = false, workoutSchedule } = body;

        if (!studentId || !templateId) {
            return new Response(JSON.stringify({ error: "studentId and templateId are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!UUID_RE.test(studentId) || !UUID_RE.test(templateId)) {
            return new Response(JSON.stringify({ error: "Invalid ID format" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 3. Get trainer
        const { data: trainer } = await supabase
            .from("trainers")
            .select("id")
            .eq("auth_user_id", user.id)
            .single();

        if (!trainer) {
            return new Response(JSON.stringify({ error: "Trainer not found" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. Validate student ownership
        const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("id", studentId)
            .eq("coach_id", trainer.id)
            .single();

        if (!student) {
            return new Response(JSON.stringify({ error: "Student not found or unauthorized" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 5. Get template (only own templates)
        const { data: template } = await supabase
            .from("program_templates")
            .select("*")
            .eq("id", templateId)
            .eq("trainer_id", trainer.id)
            .single();

        if (!template) {
            return new Response(JSON.stringify({ error: "Template not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 6. Handle immediate vs scheduled
        let status = "active";
        let scheduledStartDate: string | null = null;
        let startedAt: string | null = new Date().toISOString();

        if (isScheduled) {
            status = "scheduled";
            scheduledStartDate = startDate;
            startedAt = null;
        } else {
            // Complete current active program
            await supabase
                .from("assigned_programs")
                .update({
                    status: "completed",
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("student_id", studentId)
                .eq("status", "active");
        }

        // 7. Create assigned program
        const expiresAt = startedAt && template.duration_weeks
            ? new Date(new Date(startedAt).getTime() + template.duration_weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
            : null;

        const { data: assignedProgram, error: programError } = await supabase
            .from("assigned_programs")
            .insert({
                student_id: studentId,
                trainer_id: trainer.id,
                source_template_id: templateId,
                name: template.name,
                description: template.description,
                duration_weeks: template.duration_weeks,
                status,
                started_at: startedAt,
                scheduled_start_date: scheduledStartDate,
                current_week: 1,
                expires_at: expiresAt,
            })
            .select("id")
            .single();

        if (programError) throw programError;

        // 8. Copy workouts and items
        const { data: workouts } = await supabase
            .from("workout_templates")
            .select("*")
            .eq("program_template_id", templateId)
            .order("order_index");

        if (workouts) {
            for (const workout of workouts) {
                let scheduledDays: number[] = [];

                if (workoutSchedule?.[workout.order_index]) {
                    scheduledDays = workoutSchedule[workout.order_index];
                } else if (workout.frequency && Array.isArray(workout.frequency)) {
                    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
                    scheduledDays = workout.frequency
                        .map((d: string) => dayMap[d.toLowerCase()])
                        .filter((d: number) => d !== undefined);
                }

                const { data: assignedWorkout, error: workoutError } = await supabase
                    .from("assigned_workouts")
                    .insert({
                        assigned_program_id: assignedProgram.id,
                        source_template_id: workout.id,
                        name: workout.name,
                        order_index: workout.order_index,
                        scheduled_days: scheduledDays,
                    })
                    .select("id")
                    .single();

                if (workoutError) throw workoutError;

                // Fetch items with exercise info
                const { data: items } = await supabase
                    .from("workout_item_templates")
                    .select(`
                        *,
                        exercises (
                            id, name, equipment,
                            exercise_muscle_groups (
                                muscle_groups (name)
                            )
                        )
                    `)
                    .eq("workout_template_id", workout.id)
                    .order("order_index");

                if (items) {
                    const parentMap = new Map<string, string>();

                    // First pass: root items
                    const rootItems = items.filter((i: any) => !i.parent_item_id);
                    for (const item of rootItems) {
                        const exerciseName = (item as any).exercises?.name || null;
                        const exerciseEquipment = (item as any).exercises?.equipment || null;
                        let exerciseMuscleGroup = null;
                        if ((item as any).exercises?.exercise_muscle_groups) {
                            const groups = (item as any).exercises.exercise_muscle_groups
                                .map((emg: any) => emg.muscle_groups?.name)
                                .filter(Boolean);
                            if (groups.length > 0) exerciseMuscleGroup = groups.join(", ");
                        }

                        const { data: assignedItem, error: itemError } = await supabase
                            .from("assigned_workout_items")
                            .insert({
                                assigned_workout_id: assignedWorkout.id,
                                source_template_id: item.id,
                                item_type: item.item_type,
                                order_index: item.order_index,
                                exercise_id: item.exercise_id,
                                exercise_name: exerciseName,
                                exercise_muscle_group: exerciseMuscleGroup,
                                exercise_equipment: exerciseEquipment,
                                sets: item.sets,
                                reps: item.reps,
                                rest_seconds: item.rest_seconds,
                                notes: item.notes,
                                substitute_exercise_ids: item.substitute_exercise_ids || [],
                                exercise_function: item.exercise_function || null,
                                item_config: item.item_config || {},
                                parent_item_id: null,
                            })
                            .select("id")
                            .single();

                        if (itemError) throw itemError;
                        parentMap.set(item.id, assignedItem.id);
                    }

                    // Second pass: child items (supersets)
                    const childItems = items.filter((i: any) => i.parent_item_id);
                    for (const item of childItems) {
                        const parentAssignedId = parentMap.get((item as any).parent_item_id!);
                        if (!parentAssignedId) continue;

                        const exerciseName = (item as any).exercises?.name || null;
                        const exerciseEquipment = (item as any).exercises?.equipment || null;
                        let exerciseMuscleGroup = null;
                        if ((item as any).exercises?.exercise_muscle_groups) {
                            const groups = (item as any).exercises.exercise_muscle_groups
                                .map((emg: any) => emg.muscle_groups?.name)
                                .filter(Boolean);
                            if (groups.length > 0) exerciseMuscleGroup = groups.join(", ");
                        }

                        const { error: childError } = await supabase
                            .from("assigned_workout_items")
                            .insert({
                                assigned_workout_id: assignedWorkout.id,
                                source_template_id: item.id,
                                item_type: item.item_type,
                                order_index: item.order_index,
                                exercise_id: item.exercise_id,
                                exercise_name: exerciseName,
                                exercise_muscle_group: exerciseMuscleGroup,
                                exercise_equipment: exerciseEquipment,
                                sets: item.sets,
                                reps: item.reps,
                                rest_seconds: item.rest_seconds,
                                notes: item.notes,
                                substitute_exercise_ids: item.substitute_exercise_ids || [],
                                exercise_function: item.exercise_function || null,
                                item_config: item.item_config || {},
                                parent_item_id: parentAssignedId,
                            });

                        if (childError) throw childError;
                    }
                }
            }
        }

        // 9. Notify student
        if (status === "active") {
            await supabase.from("student_notifications").insert({
                student_id: studentId,
                trainer_id: trainer.id,
                type: "program_assigned",
                title: "Novo programa de treino!",
                subtitle: `${template.name} está disponível no seu app.`,
                payload: { program_id: assignedProgram.id, program_name: template.name },
            });
        }

        return new Response(
            JSON.stringify({ success: true, programId: assignedProgram.id }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error: any) {
        console.error("[assign-program] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Erro ao atribuir programa." }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
