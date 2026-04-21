import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonResponse({ success: false, error: "Não autorizado." }, 401);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return jsonResponse({ success: false, error: "Não autorizado." }, 401);
        }

        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        const { data: trainer, error: trainerError } = await adminClient
            .from("trainers")
            .select("id")
            .eq("auth_user_id", user.id)
            .single();

        if (trainerError || !trainer) {
            return jsonResponse({ success: false, error: "Perfil de treinador não encontrado." }, 403);
        }

        let body: { studentId?: string };
        try {
            body = await req.json();
        } catch {
            return jsonResponse({ success: false, error: "Requisição inválida." }, 400);
        }

        const studentId = body.studentId?.trim();
        if (!studentId) {
            return jsonResponse({ success: false, error: "ID do aluno é obrigatório." }, 400);
        }

        const { data: student, error: studentError } = await adminClient
            .from("students")
            .select("id, coach_id, status")
            .eq("id", studentId)
            .single();

        if (studentError || !student) {
            console.error("Error fetching student:", { studentId, trainerId: trainer.id, err: studentError?.message });
            return jsonResponse({ success: false, error: "Aluno não encontrado." }, 404);
        }

        if (student.coach_id !== trainer.id) {
            return jsonResponse(
                { success: false, error: "Aluno não encontrado ou sem permissão." },
                403
            );
        }

        if (student.status === "archived") {
            return jsonResponse({ success: true, studentId }, 200);
        }

        const { error: updateError } = await adminClient
            .from("students")
            .update({ status: "archived" })
            .eq("id", studentId)
            .eq("coach_id", trainer.id);

        if (updateError) {
            console.error("Error archiving student:", {
                studentId,
                trainerId: trainer.id,
                err: updateError.message,
            });
            return jsonResponse(
                { success: false, error: "Falha ao arquivar o aluno." },
                500
            );
        }

        return jsonResponse({ success: true, studentId }, 200);
    } catch (error) {
        console.error("Unexpected error in archive-student:", error);
        return jsonResponse({ success: false, error: "Ocorreu um erro inesperado." }, 500);
    }
});
