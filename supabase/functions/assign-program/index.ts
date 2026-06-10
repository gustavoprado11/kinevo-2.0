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
            .select("id, name")
            .eq("id", templateId)
            .eq("trainer_id", trainer.id)
            .single();

        if (!template) {
            return new Response(JSON.stringify({ error: "Template not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 6. Assign atomically — completar o programa vigente, criar o novo e
        // copiar treinos/itens/séries acontece numa transação única no banco
        // (migration 184). Falha em qualquer passo desfaz tudo; o aluno nunca
        // fica sem programa válido nem com programa pela metade.
        const { data: programId, error: rpcError } = await supabase.rpc(
            "assign_program_from_template",
            {
                p_trainer_id: trainer.id,
                p_student_id: studentId,
                p_template_id: templateId,
                p_is_scheduled: isScheduled,
                p_scheduled_start_date: isScheduled ? startDate : null,
                p_workout_schedule: workoutSchedule ?? null,
            },
        );

        if (rpcError) throw rpcError;

        // 7. Notify student — best-effort: a atribuição já está commitada,
        // falha na notificação não deve virar erro para o caller.
        // Tabela correta é student_inbox_items (o código antigo inseria em
        // "student_notifications", que NÃO EXISTE — o erro era engolido e
        // atribuições via mobile nunca notificavam o aluno). O AFTER INSERT
        // trigger on_student_inbox_item_push dispara o push automaticamente.
        if (!isScheduled) {
            const { error: notifyError } = await supabase.from("student_inbox_items").insert({
                student_id: studentId,
                trainer_id: trainer.id,
                type: "program_assigned",
                status: "unread",
                title: "Novo programa de treino!",
                subtitle: `${template.name} está disponível no seu app.`,
                payload: { program_id: programId, program_name: template.name },
            });
            if (notifyError) {
                console.error("[assign-program] notification failed:", notifyError);
            }
        }

        return new Response(
            JSON.stringify({ success: true, programId }),
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
