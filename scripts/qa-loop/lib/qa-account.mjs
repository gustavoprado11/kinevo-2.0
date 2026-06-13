// Disposable QA account lifecycle — NEVER touches Gustavo's real account.
// Mirrors the validated recipe: auth user -> trainer -> subscription (access gate) -> student.
import { loadEnv, SUPABASE_JS } from "./env.mjs";

const { createClient } = await import(SUPABASE_JS);
const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TAG = "qa-loop"; // marker so cleanup can find strays
const PASSWORD = "QaLoop!2026xyz";

export async function bootstrap() {
  const stamp = Date.now();
  const email = `qa-loop+${stamp}@kinevo-qa.invalid`;

  const { data: u, error: ue } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (ue) throw new Error("createUser: " + ue.message);
  const authUserId = u.user.id;

  const { data: tr, error: te } = await sb
    .from("trainers")
    .insert({
      auth_user_id: authUserId,
      name: "QA Loop Trainer",
      email,
      // best-effort: mark onboarding done; driver also strips overlays defensively
      onboarding_state: { completed: true, qa: TAG },
    })
    .select("id")
    .single();
  if (te) throw new Error("insert trainer: " + te.message);
  const trainerId = tr.id;

  const periodEnd = new Date(stamp + 1000 * 60 * 60 * 24 * 30).toISOString();
  const { error: se } = await sb.from("subscriptions").insert({
    trainer_id: trainerId,
    stripe_customer_id: `cus_qa_${stamp}`,
    stripe_subscription_id: `sub_qa_${stamp}`,
    status: "trialing",
    current_period_end: periodEnd,
    cancel_at_period_end: false,
  });
  if (se) throw new Error("insert subscription: " + se.message);

  // A couple of students so list/dashboard surfaces have content to render.
  const { error: ste } = await sb.from("students").insert([
    { coach_id: trainerId, name: "Aluno QA Um", email: `qa-stu1+${stamp}@kinevo-qa.invalid`, status: "active" },
    { coach_id: trainerId, name: "Aluno QA Dois", email: `qa-stu2+${stamp}@kinevo-qa.invalid`, status: "active" },
  ]);
  if (ste) throw new Error("insert students: " + ste.message);

  return { email, password: PASSWORD, trainerId, authUserId };
}

export async function teardown({ trainerId, authUserId }) {
  // child rows first, then trainer, then auth user
  const { data: studs } = await sb.from("students").select("id").eq("coach_id", trainerId);
  const studIds = (studs || []).map((s) => s.id);
  if (studIds.length) {
    await sb.from("assigned_programs").delete().in("student_id", studIds);
    await sb.from("students").delete().in("id", studIds);
  }
  await sb.from("program_templates").delete().eq("trainer_id", trainerId);
  await sb.from("subscriptions").delete().eq("trainer_id", trainerId);
  await sb.from("trainers").delete().eq("id", trainerId);
  if (authUserId) await sb.auth.admin.deleteUser(authUserId);
  return true;
}

// CLI: node lib/qa-account.mjs bootstrap|teardown <trainerId> <authUserId>
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  if (cmd === "bootstrap") {
    console.log(JSON.stringify(await bootstrap()));
  } else if (cmd === "teardown") {
    await teardown({ trainerId: process.argv[3], authUserId: process.argv[4] });
    console.log("torn down");
  } else {
    console.error("usage: bootstrap | teardown <trainerId> <authUserId>");
    process.exit(1);
  }
}
