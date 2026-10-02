import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { deletePhrase, listPhrases, parsePhrase, savePhrase } from "@/lib/server/genie-phrases";

export const dynamic = "force-dynamic";

/** Frases que o Muvo Gênio aprendeu com a pessoa logada. */
export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ phrases: await listPhrases(auth.userId) });
  } catch (err) {
    console.error("[GET /api/genie/phrases]", err);
    return NextResponse.json({ error: "Erro ao carregar frases" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const parsed = parsePhrase(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Frase inválida." }, { status: 400 });
  try {
    await savePhrase(auth.userId, parsed);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/genie/phrases]", err);
    return NextResponse.json({ error: "Erro ao salvar frase" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const phrase = new URL(request.url).searchParams.get("phrase")?.trim();
  if (!phrase) return NextResponse.json({ error: "Frase inválida." }, { status: 400 });
  try {
    await deletePhrase(auth.userId, phrase);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/genie/phrases]", err);
    return NextResponse.json({ error: "Erro ao esquecer frase" }, { status: 500 });
  }
}
