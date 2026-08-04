import { prisma } from "@/lib/prisma";
import type { Prospect } from "@/lib/types";
import { toDomainProspect } from "./mappers";

export async function getProspectsForCareer(careerId: string): Promise<Prospect[]> {
  const rows = await prisma.prospect.findMany({ where: { careerId } });
  return rows.map(toDomainProspect).sort((a, b) => b.overallRating - a.overallRating);
}
