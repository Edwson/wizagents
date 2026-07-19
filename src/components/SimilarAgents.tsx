"use client";
import AgentCard from "@/components/AgentCard";
import type { AgentDTO } from "@/lib/data";
import { Reveal, SectionLabel } from "@/components/ui";

export default function SimilarAgents({ title, agents, subscribedIds, hasPass }: {
  title: string; agents: AgentDTO[]; subscribedIds: string[]; hasPass: boolean;
}) {
  if (!agents || agents.length === 0) return null;
  return (
    <div className="mt-12">
      <SectionLabel>{title}</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((a, i) => (
          <Reveal key={a.id} className="h-full" delay={i * 60}>
            <AgentCard a={a} subscribed={subscribedIds.includes(a.id)} hasPass={hasPass} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
