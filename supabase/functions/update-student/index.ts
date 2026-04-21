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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODALITIES = new Set(["online", "presential"]);

type UpdateBody = {
    studentId?: string;
    name?: string;
    email?: string;
    phone?: string;
    modality?: string;
};

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

        let body: UpdateBody;
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
            .select("id, auth_user_id, coach_id, name, email, phone, modality, status")
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

        const updates: Record<string, string> = {};

        if (body.name !== undefined) {
            const trimmed = body.name.trim();
            if (!trimmed) {
                return jsonResponse({ success: false, error: "Nome inválido." }, 400);
            }
            updates.name = trimmed;
        }

        let emailChange: { old: string; next: string } | null = null;
        if (body.email !== undefined) {
            const trimmed = body.email.trim().toLowerCase();
            if (!EMAIL_REGEX.test(trimmed)) {
                return jsonResponse({ success: false, error: "Email inválido." }, 400);
            }
            if (trimmed !== (student.email ?? "").toLowerCase()) {
                if (!student.auth_user_id) {
                    return jsonResponse(
                        { success: false, error: "Aluno não possui conta de acesso associada." },
                        400
                    );
                }
                emailChange = { old: student.email ?? "", next: trimmed };
                updates.email = trimmed;
            }
        }

        if (body.phone !== undefined) {
            updates.phone = body.phone.replace(/\D/g, "");
        }

        if (body.modality !== undefined) {
            if (!MODALITIES.has(body.modality)) {
                return jsonResponse({ success: false, error: "Modalidade inválida." }, 400);
            }
            updates.modality = body.modality;
        }

        if (Object.keys(updates).length === 0) {
            return jsonResponse(
                {
                    success: true,
                    student: {
                        id: student.id,
                        name: student.name,
                        email: student.email,
                        phone: student.phone,
                        modality: student.modality,
                        status: student.status,
                    },
                },
                200
            );
        }

        if (emailChange) {
            const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
                student.auth_user_id!,
                { email: emailChange.next, email_confirm: true }
            );

            if (authUpdateError) {
                const msg = (authUpdateError.message ?? "").toLowerCase();
                const duplicated =
                    msg.includes("already been registered") ||
                    msg.includes("already in use") ||
                    msg.includes("already exists") ||
                    msg.includes("duplicate");
                if (duplicated) {
                    return jsonResponse({ success: false, error: "Email já está em uso." }, 400);
                }
                console.error("Admin API error updating user email:", {
                    studentId,
                    trainerId: trainer.id,
                    err: authUpdateError.message,
                });
                return jsonResponse(
                    { success: false, error: "Falha ao atualizar o email do aluno." },
                    500
                );
            }
        }

        const { data: updated, error: updateError } = await adminClient
            .from("students")
            .update(updates)
            .eq("id", studentId)
            .eq("coach_id", trainer.id)
            .select("id, name, email, phone, modality, status")
            .single();

        if (updateError || !updated) {
            console.error("Error updating student row:", {
                studentId,
                trainerId: trainer.id,
                err: updateError?.message,
            });
            return jsonResponse(
                { success: false, error: "Falha ao salvar alterações do aluno." },
                500
            );
        }

        return jsonResponse({ success: true, student: updated }, 200);
    } catch (error) {
        console.error("Unexpected error in update-student:", error);
        return jsonResponse({ success: false, error: "Ocorreu um erro inesperado." }, 500);
    }
});
