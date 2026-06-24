import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // 1. Get the user's JWT from the Authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, error: "Token não fornecido" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Create a client with the user's JWT to verify identity
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ success: false, error: "Não autorizado" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Verify the caller is a trainer
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        const { data: trainer, error: trainerError } = await adminClient
            .from("trainers")
            .select("id, ai_tier")
            .eq("auth_user_id", user.id)
            .single();

        if (trainerError || !trainer) {
            return new Response(
                JSON.stringify({ success: false, error: "Treinador não encontrado" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3b. Trava de monetização "Free = 1 aluno" (paridade com o web
        //     assertCanCreateStudent / a tool MCP kinevo_create_student). Esta edge
        //     function é chamada pelo app (AddStudentModal + conversão de lead) e
        //     ANTES não checava o cap → o mobile burlava o limite que sustenta a
        //     venda. Checa ANTES de criar o auth user (sem órfão). Só o tier Free é
        //     limitado (cap=1, o "aluno-teste"); qualquer tier pago = ilimitado.
        //     Free = sem override de ai_tier pago E sem assinatura active/trialing
        //     (espelha lib/auth/get-ai-tier).
        const aiTier = (trainer.ai_tier ?? "free") as string;
        let isPaid = aiTier !== "free";
        if (!isPaid) {
            const { data: activeSub } = await adminClient
                .from("subscriptions")
                .select("status")
                .eq("trainer_id", trainer.id)
                .in("status", ["active", "trialing"])
                .maybeSingle();
            isPaid = !!activeSub;
        }
        if (!isPaid) {
            const { count, error: countError } = await adminClient
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("coach_id", trainer.id);
            // Falha ao contar não bloqueia uma criação legítima (gate de produto,
            // não de segurança) — espelha o assertCanCreateStudent do web.
            if (!countError && (count ?? 0) >= 1) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        code: "student_cap_reached",
                        error:
                            "O plano Gratuito permite apenas 1 aluno (você mesmo, como aluno-teste). Assine um plano para adicionar mais alunos.",
                    }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // 4. Parse request body
        const body = await req.json();
        const { name, email, phone, modality } = body;

        if (!name?.trim() || !email?.trim()) {
            return new Response(
                JSON.stringify({ success: false, error: "Nome e email são obrigatórios" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 5. Generate secure password
        const randomBytes = new Uint8Array(8);
        crypto.getRandomValues(randomBytes);
        const generatedPassword = btoa(String.fromCharCode(...randomBytes))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");

        // 6. Create auth user via admin API
        const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
            email: email.trim().toLowerCase(),
            password: generatedPassword,
            email_confirm: true,
            user_metadata: {
                name: name.trim(),
                phone: phone?.trim() || null,
                role: "student",
            },
        });

        if (createError) {
            return new Response(
                JSON.stringify({ success: false, error: createError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const userId = authUser.user.id;

        // 7. Insert student record
        const { data: studentRow, error: dbError } = await adminClient
            .from("students")
            .insert({
                auth_user_id: userId,
                coach_id: trainer.id,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone?.trim() || null,
                modality: modality || "online",
                status: "active",
            })
            .select("id")
            .single();

        if (dbError) {
            // Rollback: delete the auth user
            await adminClient.auth.admin.deleteUser(userId);
            return new Response(
                JSON.stringify({ success: false, error: "Erro ao salvar dados do aluno" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 8. Fire-and-forget: trainer notification
        adminClient
            .from("trainer_notifications")
            .insert({
                trainer_id: trainer.id,
                type: "new_student",
                title: "Novo aluno vinculado",
                body: `${name.trim()} foi adicionado à sua lista.`,
                data: {
                    student_id: studentRow.id,
                    student_name: name.trim(),
                },
                category: "students",
            })
            .then(() => {});

        // 9. Return success with credentials
        return new Response(
            JSON.stringify({
                success: true,
                studentId: studentRow.id,
                email: email.trim().toLowerCase(),
                password: generatedPassword,
                name: name.trim(),
                whatsapp: phone?.trim() || null,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: "Erro inesperado ao criar aluno" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
