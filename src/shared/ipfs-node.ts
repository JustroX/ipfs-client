import * as IPFS from 'ipfs-core';

export class IPFSNode {
  private static node: Promise<IPFS.IPFS>;
  static peers: number = 0;

  private static init() {
    this.node = IPFS.create({
      repo: `${process.cwd()}/ipfs-repo`,
      start: true,
      silent: false,
      relay: {
        enabled: true,
      },
      config: {
        Routing: {
          Type: 'dht',
        },
      },
    });
    this.node.catch((err) => {
      console.error(err);
    });

    this.startPeerUpdates();
  }

  static async getNode() {
    if (!this.node) this.init();
    return await this.node;
  }

  private static async startPeerUpdates() {
    const node = await this.node;
    setInterval(() => {
      node.swarm.peers().then((x) => {
        const current_peer = x.length;
        if (current_peer != this.peers) {
          console.log(`Peers: ${current_peer}`);
          this.peers = current_peer;
        }
      });
    }, 1000);
  }
}
