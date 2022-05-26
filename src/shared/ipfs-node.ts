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
        Swarm: {
          ConnMgr: {
            HighWater: 200,
            LowWater: 50,
          },
        },
        Routing: {
          Type: 'none',
        },
      },
    });
    this.node.then((node) => {
      const stop = () => {
        node.stop();
        process.exit();
      };

      process.on('SIGTERM', stop);
      process.on('SIGINT', stop);
      process.on('SIGHUP', stop);
      process.on('uncaughtException', stop);
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
