// TeleBlock indexer — minimal read API. Apache-2.0
//
// A tiny dependency-free HTTP layer over an IndexStore so clients can fetch the read-optimized
// lists (groups, members, forum threads, reputation, identity) without scanning the chain. In
// production this sits behind the indexer fleet; search is layered on via Meilisearch (see README).
import { createServer } from 'node:http';

/**
 * @param {import('./store.js').IndexStore} store
 * @returns {import('node:http').Server}
 */
export function createApi(store) {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const seg = url.pathname.split('/').filter(Boolean);
    res.setHeader('content-type', 'application/json');

    const send = (code, body) => {
      res.statusCode = code;
      res.end(JSON.stringify(body));
    };

    try {
      // GET /groups
      if (req.method === 'GET' && seg[0] === 'groups' && seg.length === 1) {
        return send(200, { groups: store.listGroups() });
      }
      // GET /groups/:id/members
      if (req.method === 'GET' && seg[0] === 'groups' && seg[2] === 'members') {
        return send(200, { members: store.groupMembers(seg[1]) });
      }
      // GET /forums/:id/threads?sort=top|new
      if (req.method === 'GET' && seg[0] === 'forums' && seg[2] === 'threads') {
        return send(200, { threads: store.forumThreads(seg[1], { sort: url.searchParams.get('sort') ?? 'top' }) });
      }
      // GET /posts/:id/replies
      if (req.method === 'GET' && seg[0] === 'posts' && seg[2] === 'replies') {
        return send(200, { replies: store.replies(seg[1]) });
      }
      // GET /users/:addr  -> identity + reputation + badges
      if (req.method === 'GET' && seg[0] === 'users' && seg.length === 2) {
        const addr = seg[1];
        return send(200, {
          identity: store.identityOf(addr),
          reputation: store.reputationOf(addr),
          badges: store.badgesOf(addr),
        });
      }
      return send(404, { error: 'not found' });
    } catch (e) {
      return send(500, { error: String(e?.message ?? e) });
    }
  });
}
