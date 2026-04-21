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
            return jsonResponse({ success: false, error: "Payload inválido." }, 400);
        }

        const studentId = body.studentId?.trim();
        if (!studentId) {
            return jsonResponse({ success: false, error: "studentId é obrigatório." }, 400);
        }

        const { data: student, error: studentError } = await adminClient
            .from("students")
            .select("auth_user_id, coach_id")
            .eq("id", studentId)
            .single();

        if (studentError || !student) {
            console.error("Error fetching student:", studentError);
            return jsonResponse({ success: false, error: "Aluno não encontrado." }, 404);
        }

        if (student.coach_id !== trainer.id) {
            return jsonResponse(
                { success: false, error: "Acesso negado: Você não tem permissão para alterar este aluno." },
                403
            );
        }

        if (!student.auth_user_id) {
            return jsonResponse(
                { success: false, error: "Aluno não possui conta de acesso associada." },
                400
            );
        }

        const randomBytes = new Uint8Array(8);
        crypto.getRandomValues(randomBytes);
        const newPassword = btoa(String.fromCharCode(...randomBytes))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");

        const { error: updateError } = await adminClient.auth.admin.updateUserById(
            student.auth_user_id,
            { password: newPassword }
        );

        if (updateError) {
            console.error("Admin API error updating user password:", updateError);
            return jsonResponse(
                { success: false, error: "Falha ao redefinir a senha do aluno. Contate o suporte." },
                500
            );
        }

        return jsonResponse({ success: true, newPassword }, 200);
    } catch (error) {
        console.error("Unexpected error in reset-student-password:", error);
        return jsonResponse({ success: false, error: "Ocorreu um erro inesperado." }, 500);
    }
});
