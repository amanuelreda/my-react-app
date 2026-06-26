// Cross-tab transport over BroadcastChannel. Apache-2.0
//
// Implements the same Transport interface as @teleblock/shared's InMemoryRelay, but delivers frames
// to OTHER tabs/windows of the same origin via BroadcastChannel. This turns the demo from a single-
// tab simulation into a real two-party channel: open the app in two windows and they exchange
// encrypted frames over this "relay". (BroadcastChannel does not echo to the sender, so a tab never
// receives its own frames.) In production this is swapped for the Waku adapter — same interface.
/* eslint-disable @typescript-eslint/no-explicit-any */

export class BroadcastTransport {
  private ch: BroadcastChannel;
  private subs = new Map<string, Set<(frame: any) => void>>();
  private history = new Map<string, any[]>();

  constructor(name = 'teleblock-relay') {
    this.ch = new BroadcastChannel(name);
    this.ch.onmessage = (e: MessageEvent) => {
      const { topic, frame } = e.data || {};
      const set = this.subs.get(topic);
      if (set) for (const h of set) h(frame);
    };
  }

  async publish(topic: string, frame: any) {
    const hist = this.history.get(topic) ?? [];
    hist.push(frame);
    this.history.set(topic, hist);
    this.ch.postMessage({ topic, frame });
  }

  subscribe(topic: string, handler: (frame: any) => void) {
    let set = this.subs.get(topic);
    if (!set) {
      set = new Set();
      this.subs.set(topic, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  async query(topic: string) {
    return [...(this.history.get(topic) ?? [])];
  }

  close() {
    this.ch.close();
  }
}
