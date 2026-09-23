import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

function createPoll(sender: string, option3 = "") {
  return simnet.callPublicFn(
    "polls",
    "create-poll",
    [
      Cl.stringAscii("Best Clarity feature?"),
      Cl.stringAscii("Post-conditions"),
      Cl.stringAscii("Traits"),
      Cl.stringAscii(option3),
      Cl.uint(100),
    ],
    sender,
  );
}

describe("polls", () => {
  it("creates a poll and returns an incrementing id", () => {
    const first = createPoll(deployer);
    expect(first.result).toBeOk(Cl.uint(0));

    const second = createPoll(deployer);
    expect(second.result).toBeOk(Cl.uint(1));

    expect(simnet.callReadOnlyFn("polls", "get-poll-count", [], deployer).result).toBeUint(2);
  });

  it("rejects a poll with an empty question or option", () => {
    const { result } = simnet.callPublicFn(
      "polls",
      "create-poll",
      [Cl.stringAscii(""), Cl.stringAscii("A"), Cl.stringAscii("B"), Cl.stringAscii(""), Cl.uint(10)],
      deployer,
    );
    expect(result).toBeErr(Cl.uint(104));
  });

  it("lets a principal vote once and tallies the chosen option", () => {
    createPoll(deployer);
    const heightAtCreate = simnet.blockHeight;

    const vote = simnet.callPublicFn("polls", "vote", [Cl.uint(0), Cl.uint(1)], wallet1);
    expect(vote.result).toBeOk(Cl.bool(true));

    const poll = simnet.callReadOnlyFn("polls", "get-poll", [Cl.uint(0)], deployer).result;
    expect(poll).toBeSome(
      Cl.tuple({
        creator: Cl.principal(deployer),
        question: Cl.stringAscii("Best Clarity feature?"),
        "option-1": Cl.stringAscii("Post-conditions"),
        "option-2": Cl.stringAscii("Traits"),
        "option-3": Cl.stringAscii(""),
        "has-option-3": Cl.bool(false),
        "votes-1": Cl.uint(1),
        "votes-2": Cl.uint(0),
        "votes-3": Cl.uint(0),
        "created-at": Cl.uint(heightAtCreate),
        "close-at": Cl.uint(heightAtCreate + 100),
      }),
    );
  });

  it("rejects a second vote from the same principal", () => {
    createPoll(deployer);
    simnet.callPublicFn("polls", "vote", [Cl.uint(0), Cl.uint(1)], wallet1);

    const { result } = simnet.callPublicFn("polls", "vote", [Cl.uint(0), Cl.uint(2)], wallet1);
    expect(result).toBeErr(Cl.uint(101));
  });

  it("rejects a vote for option 3 when the poll only has two options", () => {
    createPoll(deployer);
    const { result } = simnet.callPublicFn("polls", "vote", [Cl.uint(0), Cl.uint(3)], wallet1);
    expect(result).toBeErr(Cl.uint(103));
  });

  it("accepts a third option when the poll defines one", () => {
    createPoll(deployer, "Neither");
    const { result } = simnet.callPublicFn("polls", "vote", [Cl.uint(0), Cl.uint(3)], wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("rejects a vote on an unknown poll id", () => {
    const { result } = simnet.callPublicFn("polls", "vote", [Cl.uint(999), Cl.uint(1)], wallet1);
    expect(result).toBeErr(Cl.uint(100));
  });

  it("closes voting once the poll's duration elapses", () => {
    simnet.callPublicFn(
      "polls",
      "create-poll",
      [Cl.stringAscii("Short poll"), Cl.stringAscii("A"), Cl.stringAscii("B"), Cl.stringAscii(""), Cl.uint(1)],
      deployer,
    );
    simnet.mineEmptyBlocks(2);

    const { result } = simnet.callPublicFn("polls", "vote", [Cl.uint(0), Cl.uint(1)], wallet2);
    expect(result).toBeErr(Cl.uint(102));
  });
});
