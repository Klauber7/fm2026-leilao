import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function envError() {
  return NextResponse.json(
    { error: "Configuração do Supabase incompleta no servidor." },
    { status: 500 }
  );
}

async function authorize(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { error: envError() };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
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
        { error: "Somente OWNER ou ADM MASTER pode alterar presidentes." },
        { status: 403 }
      ),
    };
  }

  return { admin };
}

async function listAllAuthUsers(
  admin: ReturnType<typeof createClient>
) {
  const users: any[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    users.push(...(data.users || []));

    if (!data.users || data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function GET(request: NextRequest) {
  const authorized = await authorize(request);

  if ("error" in authorized) {
    return authorized.error;
  }

  const { admin } = authorized;

  try {
    const [authUsers, teamsResult, adminsResult] = await Promise.all([
      listAllAuthUsers(admin),

      admin
        .from("teams")
        .select("id, name, manager_id, manager_name")
        .order("name", { ascending: true }),

      admin
        .from("site_admins")
        .select("user_id, role, is_active"),
    ]);

    if (teamsResult.error) {
      throw teamsResult.error;
    }

    if (adminsResult.error) {
      throw adminsResult.error;
    }

    const teams = teamsResult.data || [];

    const protectedIds = new Set(
      (adminsResult.data || [])
        .filter(
          (item: any) =>
            item.is_active &&
            String(item.role) === "owner"
        )
        .map((item: any) => String(item.user_id))
    );

    const teamByManager = new Map<string, any>();

    teams.forEach((team: any) => {
      if (team.manager_id) {
        teamByManager.set(String(team.manager_id), team);
      }
    });

    const presidents = authUsers
      .filter(
        (user: any) =>
          !protectedIds.has(String(user.id))
      )
      .map((user: any) => {
        const team =
          teamByManager.get(String(user.id)) || null;

        const metadata = user.user_metadata || {};

        const name = String(
          metadata.name ||
            metadata.full_name ||
            team?.manager_name ||
            user.email ||
            "Presidente"
        );

        return {
          userId: user.id,
          email: user.email || "",
          name,
          currentTeamId: team?.id || null,
          currentTeamName: team?.name || null,
        };
      })
      .sort((a: any, b: any) =>
        a.name.localeCompare(b.name, "pt-BR")
      );

    return NextResponse.json({
      presidents,
      teams,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Não foi possível carregar os presidentes.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authorized = await authorize(request);

  if ("error" in authorized) {
    return authorized.error;
  }

  const { admin } = authorized;

  let body: {
    userId?: string;
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

  const userId = String(body.userId || "").trim();
  const teamId = Number(body.teamId);

  if (!userId || !Number.isFinite(teamId)) {
    return NextResponse.json(
      { error: "Presidente ou time inválido." },
      { status: 400 }
    );
  }

  const { data: targetTeam, error: teamError } = await admin
    .from("teams")
    .select("id, name, manager_id")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !targetTeam) {
    return NextResponse.json(
      { error: "Time não encontrado." },
      { status: 404 }
    );
  }

  if (
    targetTeam.manager_id &&
    String(targetTeam.manager_id) !== userId
  ) {
    return NextResponse.json(
      { error: "Esse time já possui outro presidente." },
      { status: 409 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.admin.getUserById(userId);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Usuário não encontrado no Supabase Auth." },
      { status: 404 }
    );
  }

  const metadata = user.user_metadata || {};

  const presidentName = String(
    metadata.name ||
      metadata.full_name ||
      user.email ||
      "Presidente"
  );

  const { error: clearError } = await admin
    .from("teams")
    .update({
      manager_id: null,
      manager_name: null,
    })
    .eq("manager_id", userId);

  if (clearError) {
    return NextResponse.json(
      { error: "Não foi possível liberar o time atual." },
      { status: 500 }
    );
  }

  const { data: assignedTeam, error: assignError } = await admin
    .from("teams")
    .update({
      manager_id: userId,
      manager_name: presidentName,
    })
    .eq("id", teamId)
    .is("manager_id", null)
    .select("id, name, manager_id, manager_name")
    .maybeSingle();

  if (assignError) {
    return NextResponse.json(
      { error: "Não foi possível vincular o novo time." },
      { status: 500 }
    );
  }

  if (!assignedTeam) {
    return NextResponse.json(
      { error: "Esse time deixou de estar disponível. Atualize a página e tente novamente." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    president: {
      userId,
      name: presidentName,
      email: user.email || "",
    },
    team: assignedTeam,
  });
}

export async function DELETE(request: NextRequest) {
  const authorized = await authorize(request);

  if ("error" in authorized) {
    return authorized.error;
  }

  const { admin } = authorized;

  let body: {
    userId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 }
    );
  }

  const userId = String(body.userId || "").trim();

  if (!userId) {
    return NextResponse.json(
      { error: "Presidente inválido." },
      { status: 400 }
    );
  }

  const { data: removedTeams, error } = await admin
    .from("teams")
    .update({
      manager_id: null,
      manager_name: null,
    })
    .eq("manager_id", userId)
    .select("id, name");

  if (error) {
    return NextResponse.json(
      {
        error:
          "Não foi possível remover o presidente do time.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    removedTeams: removedTeams || [],
  });
}
