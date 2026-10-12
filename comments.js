/* =========================================================================
   BLOG-KOMMENTARE (eingeloggte Spieler)
   -------------------------------------------------------------------------
   Tabelle blog_comments (siehe supabase-migration-comments-and-cards.sql).
   Fehlt die Tabelle noch, zeigt das Blog einen Hinweis statt zu crashen.

   Hinweis zur Sicherheit: Die App kennt keine echten Benutzerkonten
   (Spieler-Login per PIN läuft im Browser). Der Name an einem Kommentar ist
   also so vertrauenswürdig wie dieser Login — für einen Freundeskreis okay;
   gelöscht werden kann nur vom Autor (eingeloggt) oder im Admin-Modus.

   API (window.MB.Comments):
     fetchForArticles(ids)     -> Map(articleId -> [comment])
     add({articleId, player, body}) -> comment
     remove(id)
     countByPlayer(player)     -> Zahl
     fetchRecent({sinceIso, limit}) -> [comment]  (für die Blog-Zusammenfassungen)
     sanitizeBody(text)        -> bereinigter Text (max. 500 Zeichen)
     pickHighlights(comments)  -> { total, picks:[...] } für Zusammenfassungs-Beiträge
   ========================================================================= */
(function (global) {
  "use strict";
  global.MB = global.MB || {};
  const MAX_LEN = 500, MIN_LEN = 2, COOLDOWN_MS = 8000;
  let tableMissing = false, lastPostAt = 0;

  const sb = () => (global.MB.getSupabaseClient ? global.MB.getSupabaseClient() : null);
  const isMissing = (e) => /blog_comments|relation|does not exist|42P01|PGRST205/i.test(((e && e.message) || "") + ((e && e.code) || ""));

  function sanitizeBody(text) {
    return String(text == null ? "" : text).replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_LEN);
  }

  async function fetchForArticles(ids) {
    const map = new Map(); (ids || []).forEach((i) => map.set(String(i), []));
    const c = sb(); if (!c || !ids || !ids.length) return map;
    const { data, error } = await c.from("blog_comments").select("*").in("article_id", ids.map(String)).eq("deleted", false).order("created_at", { ascending: true }).limit(3000);
    if (error) { if (isMissing(error)) tableMissing = true; else console.warn("Kommentare laden:", error.message); return map; }
    tableMissing = false;
    (data || []).forEach((r) => { const k = String(r.article_id); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    return map;
  }

  async function add({ articleId, player, body }) {
    const c = sb(); if (!c) throw new Error("Keine Datenbankverbindung.");
    if (!player) throw new Error("Bitte zuerst einloggen.");
    const text = sanitizeBody(body);
    if (text.length < MIN_LEN) throw new Error("Der Kommentar ist zu kurz.");
    const wait = COOLDOWN_MS - (Date.now() - lastPostAt);
    if (wait > 0) throw new Error(`Bitte kurz warten (${Math.ceil(wait / 1000)} s), bevor du den nächsten Kommentar schreibst.`);
    const { data, error } = await c.from("blog_comments").insert({ article_id: String(articleId), player_name: player, body: text }).select().single();
    if (error) { if (isMissing(error)) { tableMissing = true; throw new Error("Kommentare sind noch nicht eingerichtet (Datenbank-Migration fehlt)."); } throw error; }
    lastPostAt = Date.now();
    return data;
  }

  async function remove(id) {
    const c = sb(); if (!c) return;
    const { error } = await c.from("blog_comments").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  }

  async function countByPlayer(player) {
    const c = sb(); if (!c || !player) return 0;
    const { count, error } = await c.from("blog_comments").select("id", { count: "exact", head: true }).eq("player_name", player).eq("deleted", false);
    if (error) return 0;
    return count || 0;
  }

  async function fetchRecent({ sinceIso, limit } = {}) {
    const c = sb(); if (!c) return [];
    let q = c.from("blog_comments").select("*").eq("deleted", false).order("created_at", { ascending: false }).limit(limit || 200);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    const { data, error } = await q;
    if (error) { if (!isMissing(error)) console.warn("Kommentare (neueste):", error.message); return []; }
    return data || [];
  }

  // Auswahl für Zusammenfassungs-Beiträge: nur kurze, URL-freie Kommentare; je Spieler höchstens einer.
  function pickHighlights(comments, max) {
    const ok = (comments || []).filter((c) => {
      const t = sanitizeBody(c.body);
      return t.length >= 12 && t.length <= 180 && !/https?:|www\.|@/i.test(t);
    });
    const byPlayer = new Map();
    ok.forEach((c) => { const prev = byPlayer.get(c.player_name); if (!prev || c.body.length > prev.body.length) byPlayer.set(c.player_name, c); });
    const picks = [...byPlayer.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, max || 2);
    return { total: (comments || []).length, picks };
  }

  global.MB.Comments = { fetchForArticles, add, remove, countByPlayer, fetchRecent, sanitizeBody, pickHighlights, isTableMissing: () => tableMissing, MAX_LEN };
})(window);
