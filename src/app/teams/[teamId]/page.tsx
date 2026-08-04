import { notFound } from "next/navigation";
import { getCurrentCareer } from "@/lib/auth/dal";
import { getContractsForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getTeamById } from "@/lib/data-access/teams";
import { RosterTable, type RosterPlayer } from "@/components/team/RosterTable";
import { TradeProposalForm } from "@/components/team/TradeProposalForm";
import { MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { formatSalary, teamFullName } from "@/lib/utils";

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const career = await getCurrentCareer();
  const { teamId } = await params;
  const team = await getTeamById(teamId);
  if (!team) notFound();

  const [roster, contracts, league] = await Promise.all([
    getRosterForTeam(career.id, teamId),
    getContractsForTeam(career.id, teamId),
    getLeagueById(team.leagueId),
  ]);

  const contractByPlayerId = new Map(contracts.map((c) => [c.playerId, c]));
  const rosterWithContracts: RosterPlayer[] = roster.map((player) => {
    const contract = contractByPlayerId.get(player.id);
    return {
      ...player,
      salary: contract?.salary ?? 0,
      yearsRemaining: contract?.yearsRemaining ?? 0,
    };
  });

  const totalPayroll = contracts.reduce((sum, c) => sum + c.salary, 0);
  const salaryCap = league?.salaryCap ?? 0;
  const overCap = totalPayroll > salaryCap;
  const isMyTeam = team.id === career.teamId;
  const isOpponentInMyLeague = !isMyTeam && team.leagueId === career.leagueId;

  let myRosterWithContracts: RosterPlayer[] = [];
  if (isOpponentInMyLeague) {
    const [myRoster, myContracts] = await Promise.all([
      getRosterForTeam(career.id, career.teamId),
      getContractsForTeam(career.id, career.teamId),
    ]);
    const myContractByPlayerId = new Map(myContracts.map((c) => [c.playerId, c]));
    myRosterWithContracts = myRoster.map((player) => {
      const contract = myContractByPlayerId.get(player.id);
      return {
        ...player,
        salary: contract?.salary ?? 0,
        yearsRemaining: contract?.yearsRemaining ?? 0,
      };
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: team.primaryColor }}
        />
        <h1 className="text-2xl font-bold">{teamFullName(team)}</h1>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Masse salariale
          </p>
          <p className={`mt-1 text-xl font-semibold ${overCap ? "text-red-500" : ""}`}>
            {formatSalary(totalPayroll)} / {formatSalary(salaryCap)}
            {overCap && (
              <span className="ml-2 text-sm font-normal">au-dessus du plafond</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Effectif
          </p>
          <p className="mt-1 text-xl font-semibold">{roster.length} / 10 joueurs</p>
        </div>
      </div>

      <div className="mt-6">
        <RosterTable
          roster={rosterWithContracts}
          canRelease={isMyTeam && roster.length > MIN_ROSTER_SIZE}
        />
      </div>

      {isOpponentInMyLeague && (
        <TradeProposalForm
          myRoster={myRosterWithContracts}
          theirRoster={rosterWithContracts}
          opponentTeamId={team.id}
        />
      )}
    </div>
  );
}
