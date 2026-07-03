/**
 * AI read-API visibility gate (sanitized extract)
 * -----------------------------------------------
 * The platform exposes a read API for external AI assistants — search, list, and
 * per-page chunking for retrieval (RAG). The interesting engineering isn't "we
 * called an LLM." It's the permission boundary: the app decides, at the page
 * level, exactly what an assistant is allowed to read, and the database enforces
 * it. Three layers:
 *
 *   1. AUTHENTICATION. The AI endpoints require a dedicated API key — a separate
 *      credential from any human session, so AI access can be granted or revoked
 *      independently and never rides on a user's cookies.
 *
 *   2. A PER-PAGE VISIBILITY FLAG. `ai_visibility` is opt-in per page. The AI
 *      read paths filter on it in the query, so a page that isn't AI-visible is
 *      never returned to an assistant — not hidden in the client, absent from the
 *      response.
 *
 *   3. CASCADE DOWN THE TREE. Pages are a tree; flipping a parent AI-visible
 *      cascades to its subtree (and a new child inherits the parent's flag), so a
 *      whole section can be exposed or withheld as one decision instead of
 *      page-by-page drift.
 *
 * Together: "the app decides what an external AI is allowed to read, per page,"
 * enforced in the query — not a promise made in the UI.
 *
 * Sanitized: env-var and table names generalized; logic unchanged.
 */

import { Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class KnowledgeAiService {
  /** A dedicated credential for AI access, separate from any human session. */
  private readonly aiApiKey = (process.env.AI_READ_API_KEY ?? "").trim();

  constructor(private readonly db: Db) {}

  /** Every AI endpoint calls this first. A missing/blank server key means the
   *  feature is unconfigured and access is refused — never open-by-default. */
  private assertAiKey(presented: string | undefined): void {
    if (!this.aiApiKey) {
      throw new UnauthorizedException("AI read API is not configured");
    }
    if (!presented || !timingSafeEqual(presented, this.aiApiKey)) {
      throw new UnauthorizedException("Invalid AI API key");
    }
  }

  /**
   * Search — only across pages the owner marked AI-visible. The `ai_visibility`
   * predicate is in the SQL, so a non-visible page cannot appear in the result,
   * regardless of what the caller asks for.
   */
  async searchPagesForAi(apiKey: string | undefined, term: string) {
    this.assertAiKey(apiKey);
    return this.db.query(
      `select id, title, snippet(body, $1) as excerpt
         from pages
        where ai_visibility = true          -- the gate, enforced in the query
          and is_archived = false
          and body_tsv @@ plainto_tsquery($1)
        order by ts_rank(body_tsv, plainto_tsquery($1)) desc
        limit 20`,
      [term],
    );
  }

  /**
   * Page chunks for retrieval (RAG). Same gate: fetch the page ONLY if it's
   * AI-visible, then split it into retrieval-sized chunks. A non-visible page id
   * returns nothing — the assistant can't read it even with a direct id.
   */
  async getPageChunksForAi(apiKey: string | undefined, pageId: string) {
    this.assertAiKey(apiKey);
    const page = await this.db.queryOne(
      `select id, title, body
         from pages
        where id = $1
          and ai_visibility = true          -- direct-id access is gated too
          and is_archived = false`,
      [pageId],
    );
    if (!page) {
      // Indistinguishable from "doesn't exist" on purpose — a gated page must
      // not even confirm its own existence to an assistant.
      return { chunks: [] };
    }
    return { id: page.id, title: page.title, chunks: chunkForRetrieval(page.body) };
  }

  /**
   * Flip a page AI-visible and cascade to its whole subtree in one write, so a
   * section is exposed as a single decision rather than page-by-page (which
   * inevitably drifts). New children inherit the parent's flag elsewhere.
   */
  async setAiVisibilityCascade(apiKey: string | undefined, rootId: string, visible: boolean) {
    this.assertAiKey(apiKey);
    await this.db.query(
      `with recursive subtree as (
         select id from pages where id = $1
         union all
         select p.id from pages p join subtree s on p.parent_page_id = s.id
       )
       update pages set ai_visibility = $2 where id in (select id from subtree)`,
      [rootId, visible],
    );
  }
}

// --- collaborators (illustrative signatures) ---------------------------------
interface Db {
  query(sql: string, params: unknown[]): Promise<Array<Record<string, unknown>>>;
  queryOne(sql: string, params: unknown[]): Promise<Record<string, any> | null>;
}
declare function chunkForRetrieval(body: unknown): string[];
declare function timingSafeEqual(a: string, b: string): boolean;
