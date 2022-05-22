export interface Entry {
  name: string;
  type: 'directory' | 'file';
  size: number;
  cid: string;

  status_pin: 'unpinned' | 'queued' | 'pinned';
  status_content:
    | 'searching'
    | 'downloading'
    | 'timeout'
    | 'failed'
    | 'available';

  is_encrypted: boolean;
}
