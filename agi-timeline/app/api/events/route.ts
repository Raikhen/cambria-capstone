import { NextRequest, NextResponse } from "next/server";
import { getFilteredEvents } from "@/lib/events";
import type { Category } from "@/lib/types";

export const revalidate = 300;

/**
 * GET /api/events
 * Query params:
 *   categories    csv of category names (matches primary or secondary)
 *   minImportance integer 1–5
 *   from          ISO date lower bound (inclusive)
 *   to            ISO date upper bound (inclusive)
 *   q             substring match against title/summary
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const categoriesParam = params.get("categories");
  const categories = categoriesParam
    ? (categoriesParam
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean) as Category[])
    : undefined;

  const minImportanceParam = params.get("minImportance");
  const minImportance = minImportanceParam
    ? Number.parseInt(minImportanceParam, 10)
    : undefined;

  const events = await getFilteredEvents({
    categories,
    minImportance:
      minImportance !== undefined && Number.isFinite(minImportance)
        ? minImportance
        : undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    q: params.get("q") ?? undefined,
  });

  return NextResponse.json({ events, count: events.length });
}
