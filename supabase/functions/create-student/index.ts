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

        // 4. Parse request body (antes do gate — is_private muda a regra)
        const body = await req.json();
        const { name, email, phone, modality } = body;

        if (!name?.trim() || !email?.trim()) {
            return new Response(
                JSON.stringify({ success: false, error: "Nome e email são obrigatórios" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3b. Gates de monetização (paridade com o web assertCanCreateStudent /
        //     a tool MCP kinevo_create_student), checados ANTES de criar o auth
        //     user (sem órfão). Falha de contagem não bloqueia criação legítima
        //     (gate de produto, não de segurança).
        //
        //     Plano pago SOLO = ai_tier override pago OU assinatura active/trialing
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

        //     Estúdio: coach de org com billing ativo. Espelha isOrgBillingActive
        //     (org-access.ts): active/trialing, ou past_due dentro de grace_until.
        const { data: memberRow } = await adminClient
            .from("organization_members")
            .select("organization:organizations(id, plan_tier, subscription_status, grace_until)")
            .eq("trainer_id", trainer.id)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
        const orgRel = (memberRow as { organization?: unknown } | null)?.organization;
        const org = (Array.isArray(orgRel) ? orgRel[0] : orgRel) as
            | { id: string; plan_tier: string | null; subscription_status: string; grace_until: string | null }
            | null
            | undefined;
        const orgActive = !!org && (
            ["active", "trialing"].includes(org.subscription_status) ||
            (org.subscription_status === "past_due" && !!org.grace_until && new Date(org.grace_until).getTime() > Date.now())
        );
        const isPrivate = body.is_private === true;

        if (orgActive && isPrivate) {
            // Aluno PARTICULAR de coach de estúdio: exige plano solo PAGO do
            // próprio coach (decisão 16/jul — o Gratuito não vale aqui).
            if (!isPaid) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        code: "student_cap_reached",
                        error:
                            "Alunos particulares exigem um plano pessoal pago ativo. Assine um plano em Configurações → Assinatura para atender sua carteira própria.",
                    }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            // pago = particulares ilimitados
        } else if (orgActive) {
            // Aluno do ESTÚDIO: o cap é da ORG e deriva da faixa (plan_tier),
            // contando por organization_id. ANTES esta função aplicava o cap
            // solo Free ao coach de estúdio → mobile travava em 1 aluno mesmo
            // com o estúdio pagando. Mapa espelha lib/studio/studio-tiers.ts.
            const STUDIO_LIMITS: Record<string, number> = { studio_50: 50, studio_100: 100, studio_200: 200 };
            const limit = org!.plan_tier ? STUDIO_LIMITS[org!.plan_tier] : undefined;
            if (limit != null) {
                const { count, error: countError } = await adminClient
                    .from("students")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", org!.id)
                    .eq("is_trainer_profile", false);
                if (!countError && (count ?? 0) >= limit) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            code: "student_cap_reached",
                            error: `O estúdio atingiu o limite de ${limit} alunos da faixa atual. Fale com o gestor para fazer upgrade em Estúdio → Plano.`,
                        }),
                        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }
        } else if (!isPaid) {
            // Solo Free = 1 aluno (o "aluno-teste").
            const { count, error: countError } = await adminClient
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("coach_id", trainer.id);
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
                // Só coach de estúdio marca particular (o trigger derive respeita).
                is_private: orgActive && isPrivate,
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
