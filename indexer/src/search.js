// TeleBlock search index. Apache-2.0
//
// A lightweight inverted-index full-text search over public, indexable documents: groups, forums,
// forum posts, and usernames. Tokenized with TF scoring + a title-field boost and prefix matching on
// the final query token (so "encr" matches "encrypted"). In production this interface is backed by
// Meilisearch; the in-memory implementation here is the reference and keeps the logic unit-testable.
//
// Only PUBLIC content is searchable: public group/forum metadata, public forum post text resolved
// from IPFS, and usernames. Private chats and E2EE content are never indexed here — clients search
// those locally against decrypted history.

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 're']);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

export class SearchIndex {
  constructor() {
    /** @type {Map<string, {id:string,type:string,refId:string,title:string,body:string}>} */
    this.docs = new Map();
    /** token -> Set(docId) */
    this.index = new Map();
    /** docId -> Map(token -> {title:count, body:count}) */
    this.freq = new Map();
  }

  /** Add or replace a document. type ∈ {group, forum, post, user}. */
  add(doc) {
    this.remove(doc.id);
    this.docs.set(doc.id, doc);
    const f = new Map();
    const tally = (text, field) => {
      for (const tok of tokenize(text)) {
        let e = f.get(tok);
        if (!e) {
          e = { title: 0, body: 0 };
          f.set(tok, e);
        }
        e[field] += 1;
        if (!this.index.has(tok)) this.index.set(tok, new Set());
        this.index.get(tok).add(doc.id);
      }
    };
    tally(doc.title ?? '', 'title');
    tally(doc.body ?? '', 'body');
    this.freq.set(doc.id, f);
    return this;
  }

  remove(id) {
    if (!this.docs.has(id)) return;
    const f = this.freq.get(id);
    if (f) {
      for (const tok of f.keys()) {
        const set = this.index.get(tok);
        if (set) {
          set.delete(id);
          if (set.size === 0) this.index.delete(tok);
        }
      }
    }
    this.freq.delete(id);
    this.docs.delete(id);
  }

  /**
   * Search. The last query token is prefix-matched; earlier tokens are exact. Score = sum over
   * matched tokens of titleCount*TITLE_BOOST + bodyCount, with a small bonus per distinct token hit.
   * @param {string} query
   * @param {{limit?:number, type?:string}} [opts]
   */
  search(query, opts = {}) {
    const TITLE_BOOST = 4;
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const last = tokens[tokens.length - 1];

    const scores = new Map(); // docId -> {score, hits}
    const bump = (docId, add) => {
      const s = scores.get(docId) ?? { score: 0, hits: 0 };
      s.score += add;
      s.hits += 1;
      scores.set(docId, s);
    };

    tokens.forEach((tok, i) => {
      const isLast = i === tokens.length - 1;
      // exact token match
      const exact = this.index.get(tok);
      if (exact) for (const docId of exact) bump(docId, this._weight(docId, tok, TITLE_BOOST));
      // prefix match for the final token (typeahead)
      if (isLast && tok === last) {
        for (const [term, set] of this.index) {
          if (term !== tok && term.startsWith(tok)) {
            for (const docId of set) bump(docId, this._weight(docId, term, TITLE_BOOST) * 0.6);
          }
        }
      }
    });

    let results = [...scores.entries()]
      .map(([id, s]) => ({ ...this.docs.get(id), score: s.score, hits: s.hits }))
      .filter((d) => (opts.type ? d.type === opts.type : true));
    // rank: more distinct query-token hits first, then score
    results.sort((a, b) => b.hits - a.hits || b.score - a.score);
    return results.slice(0, opts.limit ?? 20);
  }

  _weight(docId, token, titleBoost) {
    const e = this.freq.get(docId)?.get(token);
    if (!e) return 0;
    return e.title * titleBoost + e.body;
  }
}

/**
 * Build searchable documents from an IndexStore plus display metadata (names/text resolved off-chain
 * from CIDs). Returns a populated SearchIndex.
 * @param {import('./store.js').IndexStore} store
 * @param {{groups?:Record<string,{name:string}>, forums?:Record<string,{name:string}>, posts?:Record<string,{title:string,preview:string}>, users?:Record<string,string>}} meta
 */
export function buildSearchIndex(store, meta = {}) {
  const si = new SearchIndex();
  for (const g of store.groups.values()) {
    si.add({ id: `group:${g.id}`, type: 'group', refId: g.id, title: meta.groups?.[g.id]?.name ?? `Group ${g.id}`, body: '' });
  }
  for (const f of store.forums.values()) {
    si.add({ id: `forum:${f.id}`, type: 'forum', refId: f.id, title: meta.forums?.[f.id]?.name ?? `Forum ${f.id}`, body: '' });
  }
  for (const p of store.posts.values()) {
    const pm = meta.posts?.[p.id];
    si.add({ id: `post:${p.id}`, type: 'post', refId: p.id, title: pm?.title ?? `Post ${p.id}`, body: pm?.preview ?? '' });
  }
  for (const [addr, name] of Object.entries(meta.users ?? {})) {
    si.add({ id: `user:${addr}`, type: 'user', refId: addr, title: name, body: '' });
  }
  return si;
}
