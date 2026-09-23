"use client";

import { useCallback, useEffect, useState } from "react";
import { Cl } from "@stacks/transactions";
import { useAtomValue } from "jotai";
import { addressAtom } from "@/store/wallet";
import { scaffoldConfig } from "@/scaffold.config";
import { usePolls_CreatePoll, usePolls_Vote } from "@/generated/hooks";
import {
  polls_getPoll,
  polls_getPollCount,
  polls_hasAccountVoted,
} from "@/generated/contracts";
import deployments from "@/generated/deployments.json";
import { unwrapClarity, isValidPrincipal } from "@/lib/clarity";

const CONTRACT = "polls";

type Poll = {
  id: number;
  creator: string;
  question: string;
  options: { label: string; votes: bigint }[];
  createdAt: bigint;
  closeAt: bigint;
  hasVoted: boolean;
};

function useContractId() {
  return (deployments as any)?.contracts?.[CONTRACT]?.contract_id as string | undefined;
}

async function loadPoll(id: number, voter: string | null): Promise<Poll | null> {
  const raw = await polls_getPoll([Cl.uint(id)]);
  const data = unwrapClarity(raw);
  if (!data) return null;

  const options = [
    { label: String(data["option-1"]), votes: BigInt(data["votes-1"] ?? 0) },
    { label: String(data["option-2"]), votes: BigInt(data["votes-2"] ?? 0) },
  ];
  if (data["has-option-3"]) {
    options.push({ label: String(data["option-3"]), votes: BigInt(data["votes-3"] ?? 0) });
  }

  let hasVoted = false;
  if (voter) {
    const votedRaw = await polls_hasAccountVoted([Cl.uint(id), Cl.principal(voter)]);
    hasVoted = Boolean(unwrapClarity(votedRaw));
  }

  return {
    id,
    creator: String(data.creator),
    question: String(data.question),
    options,
    createdAt: BigInt(data["created-at"] ?? 0),
    closeAt: BigInt(data["close-at"] ?? 0),
    hasVoted,
  };
}

function PollCard({
  poll,
  currentHeight,
  onVoted,
}: {
  poll: Poll;
  currentHeight: bigint | null;
  onVoted: () => void;
}) {
  const address = useAtomValue(addressAtom);
  const { call, loading, error, txStatus, txStatusError, explorerUrl } = usePolls_Vote();
  const [pendingOption, setPendingOption] = useState<number | null>(null);

  const isOpen = currentHeight === null ? true : currentHeight < poll.closeAt;
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, BigInt(0));

  useEffect(() => {
    if (txStatus === "success") onVoted();
  }, [txStatus, onVoted]);

  const castVote = async (optionIndex: number) => {
    if (!isValidPrincipal(address)) return;
    setPendingOption(optionIndex);
    try {
      await call([Cl.uint(poll.id), Cl.uint(optionIndex + 1)]);
    } catch {
      // surfaced via `error` below
    }
  };

  return (
    <div className="border border-[#2A2A2C] rounded-2xl p-5 bg-[#18181A] w-full">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-white text-[16px] font-medium font-instrument">{poll.question}</h3>
        <span
          className={`shrink-0 text-[10px] font-mono px-2 py-1 rounded-full ${
            isOpen ? "bg-[#1E3A2A] text-[#5FD98A]" : "bg-[#3A1E1E] text-[#D95F5F]"
          }`}
        >
          {isOpen ? "open" : "closed"}
        </span>
      </div>
      <p className="text-[10px] font-mono text-[#6B6969] mt-1">
        poll #{poll.id} · closes at block {poll.closeAt.toString()}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {poll.options.map((opt, i) => {
          const pct = totalVotes > BigInt(0) ? Number((opt.votes * BigInt(100)) / totalVotes) : 0;
          const disabled =
            loading || poll.hasVoted || !isOpen || !isValidPrincipal(address);
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => castVote(i)}
              className="relative w-full text-left rounded-lg overflow-hidden border border-[#2A2A2C] disabled:cursor-not-allowed group"
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#2A3A4A] transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 group-hover:bg-white/5 transition-colors">
                <span className="text-[12px] font-mono text-white">
                  {opt.label}
                  {loading && pendingOption === i ? " …" : ""}
                </span>
                <span className="text-[11px] font-mono text-[#9A9898]">
                  {opt.votes.toString()} vote{opt.votes === BigInt(1) ? "" : "s"} · {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[16px]">
        {!isValidPrincipal(address) && (
          <p className="text-[10px] font-mono text-[#6B6969]">Connect a wallet to vote.</p>
        )}
        {isValidPrincipal(address) && poll.hasVoted && (
          <p className="text-[10px] font-mono text-[#5FD98A]">You already voted on this poll.</p>
        )}
        {error && <p className="text-[10px] font-mono text-[#D95F5F]">{error.message}</p>}
        {txStatus === "abort_by_response" && (
          <p className="text-[10px] font-mono text-[#D95F5F]">{txStatusError}</p>
        )}
        {txStatus === "pending" && explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-[#8F8D8E] underline"
          >
            transaction pending — view on explorer
          </a>
        )}
      </div>
    </div>
  );
}

function CreatePollForm({ onCreated }: { onCreated: () => void }) {
  const address = useAtomValue(addressAtom);
  const contractId = useContractId();
  const { call, loading, error, txStatus, txStatusError, explorerUrl } = usePolls_CreatePoll();
  const [question, setQuestion] = useState("");
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [option3, setOption3] = useState("");
  const [duration, setDuration] = useState(1000);

  useEffect(() => {
    if (txStatus === "success") {
      setQuestion("");
      setOption1("");
      setOption2("");
      setOption3("");
      onCreated();
    }
  }, [txStatus, onCreated]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !option1.trim() || !option2.trim()) return;
    await call([
      Cl.stringAscii(question.trim()),
      Cl.stringAscii(option1.trim()),
      Cl.stringAscii(option2.trim()),
      Cl.stringAscii(option3.trim()),
      Cl.uint(duration),
    ]);
  };

  if (!contractId) {
    return (
      <p className="text-[11px] font-mono text-[#D95F5F]">
        polls contract not deployed — run{" "}
        <code>stacksdapp deploy --network testnet --contract polls --yes</code>
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border border-[#2A2A2C] rounded-2xl p-5 bg-[#18181A] w-full flex flex-col gap-3"
    >
      <h3 className="text-white text-[16px] font-medium font-instrument">Create a poll</h3>
      <input
        className="bg-[#0F0F10] border border-[#2A2A2C] rounded-lg px-3 py-2 text-[12px] font-mono text-white placeholder:text-[#6B6969]"
        placeholder="Question"
        maxLength={280}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[#0F0F10] border border-[#2A2A2C] rounded-lg px-3 py-2 text-[12px] font-mono text-white placeholder:text-[#6B6969]"
          placeholder="Option 1"
          maxLength={64}
          value={option1}
          onChange={(e) => setOption1(e.target.value)}
        />
        <input
          className="flex-1 bg-[#0F0F10] border border-[#2A2A2C] rounded-lg px-3 py-2 text-[12px] font-mono text-white placeholder:text-[#6B6969]"
          placeholder="Option 2"
          maxLength={64}
          value={option2}
          onChange={(e) => setOption2(e.target.value)}
        />
      </div>
      <input
        className="bg-[#0F0F10] border border-[#2A2A2C] rounded-lg px-3 py-2 text-[12px] font-mono text-white placeholder:text-[#6B6969]"
        placeholder="Option 3 (optional)"
        maxLength={64}
        value={option3}
        onChange={(e) => setOption3(e.target.value)}
      />
      <label className="text-[11px] font-mono text-[#8F8D8E] flex items-center gap-2">
        Duration (blocks)
        <input
          type="number"
          min={1}
          max={52560}
          className="w-24 bg-[#0F0F10] border border-[#2A2A2C] rounded-lg px-2 py-1 text-[12px] font-mono text-white"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </label>

      <button
        type="submit"
        disabled={loading || !isValidPrincipal(address) || !question.trim() || !option1.trim() || !option2.trim()}
        className="mt-1 bg-white text-black text-[12px] font-mono font-medium rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Broadcasting…" : "Create poll"}
      </button>

      {!isValidPrincipal(address) && (
        <p className="text-[10px] font-mono text-[#6B6969]">Connect a wallet to create a poll.</p>
      )}
      {error && <p className="text-[10px] font-mono text-[#D95F5F]">{error.message}</p>}
      {txStatus === "abort_by_response" && (
        <p className="text-[10px] font-mono text-[#D95F5F]">{txStatusError}</p>
      )}
      {txStatus === "pending" && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-[#8F8D8E] underline"
        >
          transaction pending — view on explorer
        </a>
      )}
    </form>
  );
}

export default function PollBoard() {
  const address = useAtomValue(addressAtom);
  const contractId = useContractId();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [currentHeight, setCurrentHeight] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      const countRaw = await polls_getPollCount([]);
      const count = Number(unwrapClarity(countRaw) ?? 0);
      const voter = isValidPrincipal(address) ? address : null;
      const ids = Array.from({ length: count }, (_, i) => count - 1 - i); // newest first
      const loaded = await Promise.all(ids.map((id) => loadPoll(id, voter)));
      setPolls(loaded.filter((p): p is Poll => p !== null));
    } finally {
      setLoading(false);
    }
  }, [contractId, address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!scaffoldConfig.nodeUrl) return;
    fetch(`${scaffoldConfig.nodeUrl}/v2/info`)
      .then((r) => r.json())
      .then((info) => setCurrentHeight(BigInt(info.stacks_tip_height ?? info.burn_block_height ?? 0)))
      .catch(() => {});
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-6 pb-16">
      <div className="w-full max-w-[640px]">
        <CreatePollForm onCreated={refresh} />
      </div>

      <div className="w-full max-w-[640px] flex flex-col gap-4">
        {loading && polls.length === 0 && (
          <p className="text-[11px] font-mono text-[#6B6969] text-center">Loading polls…</p>
        )}
        {!loading && polls.length === 0 && (
          <p className="text-[11px] font-mono text-[#6B6969] text-center">
            No polls yet — create the first one above.
          </p>
        )}
        {polls.map((poll) => (
          <PollCard key={poll.id} poll={poll} currentHeight={currentHeight} onVoted={refresh} />
        ))}
      </div>
    </div>
  );
}
