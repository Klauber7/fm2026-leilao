import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function missingEnvResponse() {
  return NextResponse.json(
    {
      error:
        "Variáveis do Supabase ausentes. Confira NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.",
    },
    { status: 500 }
  );
}

async function getAuthorizedAdmin(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { error: missingEnvResponse() };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Sessão não encontrada." },
        { status: 401 }
      ),
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Sessão inválida ou expirada." },
        { status: 401 }
      ),
    };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: roleRow, error: roleError } = await admin
    .from("site_admins")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    roleError ||
    !roleRow ||
    !roleRow.is_active ||
    !["owner", "master"].includes(String(roleRow.role))
  ) {
    return {
      error: NextResponse.json(
        { error: "Somente OWNER ou ADM MASTER pode criar presidentes." },
        { status: 403 }
      ),
    };
  }

  return { admin, user };
}

export async function GET(request: NextRequest) {
  const authorized = await getAuthorizedAdmin(request);
  if ("error" in authorized) return authorized.error;

  const { admin } = authorized;

  const { data: teams, error } = await admin
    .from("teams")
    .select("id, name, manager_id, manager_name")
    .is("manager_id", null)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Não foi possível carregar os times livres." },
      { status: 500 }
    );
  }

  return NextResponse.json({ teams: teams || [] });
}

export async function POST(request: NextRequest) {
  const authorized = await getAuthorizedAdmin(request);
  if ("error" in authorized) return authorized.error;

  const { admin, user: actingUser } = authorized;

  let body: {
    name?: string;
    email?: string;
    password?: string;
    teamId?: number | string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 }
    );
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const teamId = Number(body.teamId);

  if (!name || !email || !password || !Number.isFinite(teamId)) {
    return NextResponse.json(
      { error: "Preencha nome, email, senha e time." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "A senha precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("id, name, manager_id")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    return NextResponse.json(
      { error: "Time não encontrado." },
      { status: 404 }
    );
  }

  if (team.manager_id) {
    return NextResponse.json(
      { error: "Esse time já possui presidente." },
      { status: 409 }
    );
  }

  const {
    data: created,
    error: createError,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      full_name: name,
      role: "president",
      team_id: teamId,
      team_name: team.name,
    },
  });

  if (createError || !created.user) {
    const message = createError?.message || "Não foi possível criar o usuário.";

    if (
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("registered")
    ) {
      return NextResponse.json(
        { error: "Já existe uma conta com esse email." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const newUserId = created.user.id;

  const { error: linkError } = await admin
    .from("teams")
    .update({
      manager_id: newUserId,
      manager_name: name,
    })
    .eq("id", teamId)
    .is("manager_id", null);

  if (linkError) {
    await admin.auth.admin.deleteUser(newUserId);

    return NextResponse.json(
      {
        error:
          "O usuário foi criado, mas não foi possível vincular o time. A conta criada foi removida para evitar inconsistência.",
      },
      { status: 500 }
    );
  }

  const { error: approvalError } = await admin
    .from("user_approvals")
    .upsert(
      {
        user_id: newUserId,
        email,
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: actingUser.id,
      },
      { onConflict: "user_id" }
    );

  if (approvalError) {
    console.error("Falha ao registrar aprovação automática:", approvalError);
  }

  return NextResponse.json({
    ok: true,
    president: {
      userId: newUserId,
      name,
      email,
      teamId,
      teamName: team.name,
    },
  });
}
