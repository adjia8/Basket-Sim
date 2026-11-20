"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { prisma } from "@/lib/prisma";
import { getConversationSetup } from "@/lib/data-access/player-conversations";
import {
  CONVERSATION_TONES,
  conversationOutcome,
  type ConversationTone,
  type ConversationTopic,
} from "@/lib/careers/player-conversation-rules";
import { clampMorale } from "@/lib/careers/morale-rules";
import { personalityFor, scaleMoraleDelta } from "@/lib/careers/personality-rules";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";

export interface ConversationFormState {
  error?: string;
  gmLine?: string;
  reply?: string;
  reaction?: string;
  tone?: "good" | "neutral" | "bad";
  effect?: string;
}

// Une discussion avec l'un de mes joueurs : sujet + ton → réaction, moral,
// et éventuellement une promesse ou une demande d'échange (voir
// player-conversation-rules.ts).
export async function talkToPlayer(
  _prev: ConversationFormState | undefined,
  formData: FormData
): Promise<ConversationFormState> {
  const { userId } = await verifySession();
  const { t } = await getTranslator();
  const playerId = String(formData.get("playerId") ?? "");
  const topic = String(formData.get("topic") ?? "") as ConversationTopic;
  const tone = String(formData.get("tone") ?? "") as ConversationTone;
  if (!CONVERSATION_TONES.includes(tone)) return { error: t("talk.error.invalid") };

  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId), include: { career: true } });
  if (!membership) return { error: t("rosterAction.noCareer") };
  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return { error: t("talk.error.invalid") };

  const setup = await getConversationSetup(membership.careerId, membership.career.season, membership.teamId, playerId);
  if (!setup || !setup.topics.includes(topic)) return { error: t("talk.error.invalid") };
  if (setup.cooldownDays > 0) return { error: t("talk.error.cooldown", { days: setup.cooldownDays }) };

  const outcome = conversationOutcome(topic, tone, setup.context);
  const state = await prisma.playerState.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!state) return { error: t("talk.error.invalid") };
  const delta = scaleMoraleDelta(outcome.moraleDelta, personalityFor(playerId, state.age));
  const season = membership.career.season;
  const when = setup.today ?? new Date(0);

  await prisma.playerState.update({
    where: { id: state.id },
    data: {
      morale: clampMorale(state.morale + delta),
      lastConversationAt: when,
      // Toute discussion répond à sa demande en attente.
      pendingRequest: null,
      requestAt: null,
      ...(outcome.effect === "promise_minutes" && setup.nextStatus
        ? { promisedStatus: setup.nextStatus, promiseSince: when }
        : {}),
      ...(outcome.effect === "promise_trade"
        ? { activePromiseType: "trade", activePromiseSeason: season, promiseOriginTeamId: membership.teamId }
        : {}),
      ...(outcome.effect === "clear_trade_request"
        ? { wantsTrade: false, tradeRequestReasonsJson: null, tradeRequestSinceSeason: null }
        : {}),
      ...(outcome.effect === "trade_request"
        ? { wantsTrade: true, tradeRequestReasonsJson: JSON.stringify(["morale"]), tradeRequestSinceSeason: season }
        : {}),
    },
  });

  revalidatePath("/teams/[teamId]/players/[playerId]", "page");
  revalidatePath(`/teams/${membership.teamId}`);
  // Variante de réplique stable pour un même joueur et un même sujet.
  const variant = (playerId.length + topic.length) % 2;
  return {
    gmLine: t(`talk.gm.${topic}.${tone}` as DictionaryKey),
    reply: t(`talk.reply.${topic}.${outcome.reaction}.${variant}` as DictionaryKey),
    reaction: t(`talk.reaction.${outcome.reaction}` as DictionaryKey),
    tone: delta > 0 ? "good" : delta < 0 ? "bad" : "neutral",
    effect: outcome.effect
      ? t(`talk.effect.${outcome.effect}` as DictionaryKey, {
          status: setup.nextStatus ? t(`status.${setup.nextStatus}` as DictionaryKey) : "",
        })
      : undefined,
  };
}
