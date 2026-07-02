# tasks-knowledge — a work & knowledge platform

A full-stack platform that combines three things most teams juggle across separate tools: a **wiki with
a block editor**, **Notion-style databases inside documents**, and a **project/task manager** — with an
**AI layer** wired through the whole thing. Built as a solo full-stack project.

It's a real, working product. The engine is solid; what remained before calling it finished was the last
20% of UX polish. I think knowing the difference between "the engine works" and "it feels finished" is
itself worth showing.

---

## What it does

**A wiki with a real block editor.** Pages live in a tree (nest them however you like, with icons and
cover images). The editor is built on TipTap with custom blocks — callouts, tables, embeds, bookmarks,
images, audio and video, a table of contents. Every page keeps a full revision history, so you can see
what changed and roll back. Comments can even carry audio attachments.

**Databases inside documents — the real thing, not a fake.** You can drop a database into a page:
records with typed properties (text, number, date, select, multi-select, person, files, URL, status —
and relations that link records to each other or to work tasks). The same data renders as a **table, a
board, a calendar, a gallery, or a list**, and each view keeps its own filters and sorting. This is the
Notion feature people actually miss when they leave Notion, and it works here.

**A full project manager.** Projects, tasks, sections, dependencies, checklists, time tracking, custom
fields, comment threads with reactions, dashboards with configurable widgets, and per-list calendar
feeds you can subscribe to. This is the biggest domain in the app — around 40 tables on its own.

**More, because a real workspace needs it.** A form builder (with public/anonymous submission), an org
structure with departments and manager hierarchy, OKRs and goals, a lightweight social feed (groups,
news, comments, likes), and a unified notification center with web push.

**An AI layer that's designed in, not bolted on.** A prompt bank organizes prompts by department × model
× type, so the right prompt is used for the right job. More interestingly, there's a dedicated
**read API for AI** (`/knowledge/ai`) with search, listing, and **page chunking for retrieval (RAG)** —
gated per page by a visibility flag and its own API keys. In other words: the app decides exactly what an
external AI assistant is allowed to read, at the page level. That access control *is* the interesting
part — not "we called an LLM," but "we built the permission boundary an LLM has to respect."

---

## How it's built

- **Frontend:** Next.js 15 (App Router), React, TypeScript, TipTap for the editor, dnd-kit for
  drag-and-drop, Recharts for dashboards. ~90 components across ~30 route areas.
- **Backend:** NestJS, TypeScript, split into cohesive modules (knowledge, projects, calendar, team,
  notifications). The knowledge module alone is broken into ~20 focused "flow" files behind one service
  — a big domain kept readable.
- **Database:** PostgreSQL (via Supabase). **SQL-first, no ORM** — ~126 hand-written, idempotent
  migrations, ~90 tables. Authorization is done with **Row-Level Security in the database itself**, not
  just app-level checks, so a leak in the app layer can't hand you data the database won't release.

## The engineering worth pointing at

- **SQL-first with RLS as the security boundary.** No ORM. The database enforces who can see what, with
  dedicated RLS migrations per entity. It's more work up front and much harder to bypass later.
- **Deliberate query tuning.** Several migrations exist purely for indexes and performance — search
  functions, trash listing, notification debounce. The schema was tuned as it grew, not left to chance.
- **Real-time collaboration.** Live updates (comments, share links, notifications, task changes) through
  Supabase Realtime, with explicit control over what's published.
- **A versioned editor schema.** The editor's document format is versioned, so old revisions still open
  correctly after the format evolves — the kind of thing that bites you later if you don't plan for it.
- **Unified soft-delete / trash** across every entity type, with performance-tuned listing.

## Scale, honestly

~126 database migrations · ~90 tables · seven-plus distinct product domains (wiki, doc-databases,
projects, forms, OKRs, org/people, social feed, AI) · ~150 files across the two apps. Built and shipped
by one person.

## The honest status

The engine works end to end — auth, the data model, the editor, real-time sync, deploy. What was left
was polish: making it *feel* as finished as it functions. I'd rather show a real product with an honest
"here's the last 20%" than a demo dressed up as done.

---

*Built by Rustem Idiatullin. Full-stack — data model to editor. Relocating to Australia or New Zealand.*
