import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProgress } from "./progress";

const bridge = vi.hoisted(() => ({
  readProgress: vi.fn(),
  saveProgress: vi.fn(),
  preserveRecovery: vi.fn(),
}));
vi.mock("./platform", () => ({ isAndroid: true, native: bridge }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  const values = new Map<string, string>();
  const local = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  vi.stubGlobal("window", { localStorage: local });
  vi.stubGlobal("localStorage", local);
  bridge.saveProgress.mockResolvedValue(undefined);
  bridge.preserveRecovery.mockResolvedValue(undefined);
});

describe("Android progress durability", () => {
  it("restores native progress before rendering and keeps the latest of overlapping saves", async () => {
    const restored = emptyProgress();
    restored.settings.dailyNew = 6;
    bridge.readProgress.mockResolvedValue({
      content: JSON.stringify(restored),
    });
    const storage = await import("./storage");
    await storage.prepareStorage();
    expect(storage.initialProgress().progress.settings.dailyNew).toBe(6);

    let release!: () => void;
    bridge.saveProgress.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = storage.saveProgress(restored);
    const latest = {
      ...restored,
      settings: { ...restored.settings, dailyNew: 8 },
    };
    const second = storage.saveProgress(latest);
    await vi.waitFor(() =>
      expect(bridge.saveProgress).toHaveBeenCalledTimes(1),
    );
    release();
    await Promise.all([first, second]);
    expect(
      JSON.parse(bridge.saveProgress.mock.calls.at(-1)![0].content).settings
        .dailyNew,
    ).toBe(8);
    expect(
      JSON.parse(localStorage.getItem("frasi.progress.v1")!).settings.dailyNew,
    ).toBe(8);
  });

  it("does not overwrite unreadable native data with an empty profile", async () => {
    bridge.readProgress.mockRejectedValue(new Error("I/O failure"));
    const storage = await import("./storage");
    await storage.prepareStorage();
    expect(storage.initialProgress().warning).toContain("не записываются");
    await storage.saveProgress(emptyProgress());
    expect(bridge.saveProgress).not.toHaveBeenCalled();
  });

  it("keeps malformed native data recoverable before creating a new profile", async () => {
    bridge.readProgress.mockResolvedValue({ content: "damaged progress" });
    bridge.preserveRecovery.mockRejectedValue(new Error("Disk full"));
    const storage = await import("./storage");
    await storage.prepareStorage();
    expect(bridge.preserveRecovery).toHaveBeenCalledWith({
      content: "damaged progress",
    });
    await storage.saveProgress(emptyProgress());
    expect(bridge.saveProgress).not.toHaveBeenCalled();
  });
});
