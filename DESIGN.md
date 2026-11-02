---
name: Master League
description: A premium, public-facing home for the 2026 league season.
colors:
  ink: "#17243b"
  ink-soft: "#31415d"
  paper: "#f6f8fc"
  surface: "#ffffff"
  surface-soft: "#f3f7ff"
  muted: "#53627a"
  muted-on-dark: "#b8c4dc"
  border: "#e2e9f4"
  blue: "#5a79d8"
  blue-deep: "#3656b2"
  blue-highlight: "#9bb1ff"
  master-orange: "#ff5426"
  master-amber: "#f7a900"
  status-green: "#37745c"
  seirin: "#e02737"
  alhamdulillah: "#d41a24"
  psychoriders: "#b9ff05"
  blue-lock: "#4671aa"
typography:
  display:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "clamp(36px, 5vw, 65px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.55
  label:
    fontFamily: "Poppins, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "10px"
  panel: "15px"
  hero: "18px"
  season-card: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  2xl: "32px"
components:
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  nav-active:
    backgroundColor: "#edf2ff"
    textColor: "#3e5fbe"
    rounded: "{rounded.md}"
  hero-link:
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
---

## Overview

Master League is a clear, public scorebook for the 2026 season. Its visual system uses crisp white surfaces, cool blue neutrals, and restrained indigo accents to make actual match outcomes and standings easy to scan. The responsive hero pairs a desktop league-table preview with a mobile latest-result preview, expressing one data set across both screen sizes. The separate admin surface remains distinct and supports authenticated league updates.

The logo artwork in `assets/master-league-logo.png`, `assets/fc-seirin.jpg`, `assets/fc-alhamdulillah.png`, `assets/psychoriders.png`, and `assets/blue-lock-fc.png` was supplied by the user and is retained without visual alteration. The Master League mark uses black negative space, orange and amber circles, and white outlines/type; its white-backed rounded square keeps the mark legible in both desktop and mobile navigation.

## Colors

- Cool near-white (`#f6f8fc`) is the page ground, with white reserved for content surfaces.
- Ink navy (`#17243b`) anchors type and navigation; slate blue (`#53627a`) carries secondary information.
- Indigo (`#5a79d8`) highlights points, selected controls, and data focus. Pale blue gradients give the hero its ambient depth without reducing text contrast.
- Green is reserved for season status.
- Club colors remain factual identifiers: Seirin red (`#e02737`), Alhamdulillah red (`#d41a24`), Psychoriders lime (`#b9ff05`), and Blue Lock blue (`#4671aa`).
- Master League orange and amber remain part of its supplied logo, not a competing interface accent.
- Use muted text only where it still meets accessible contrast against its actual surface.
- The light theme is the default. The optional dark theme uses a deep navy canvas, lifted blue-gray surfaces, pale text and softened indigo accents while retaining the club colors.

## Typography

Poppins Bold (700) is the single interface weight, requested for consistent emphasis throughout the site. The display scale and spacing continue to distinguish headings from body copy and metadata. Headings use controlled tracking (no tighter than `-0.04em`); compact labels remain 9-10px, while paragraph and explanatory text retain their existing sizes and line heights. Use tabular numerals for scores and standings.

## Layout

At wide widths, a compact horizontal navigation frames the main workspace. The hero pairs the season introduction with isometric desktop standings and mobile match-result mockups, both bound to real league data. Actual season totals, matchdays, the table, and club directory follow in a responsive analytics grid.

At widths up to 900px, navigation becomes an accessible off-canvas menu, the hero preview stacks below its introduction, data panels become a single column, and club cards adapt to a two-column grid. At 390px, the season metrics form a two-by-two arrangement and the standings table scrolls inside its own region rather than widening the page. The active navigation state follows the section currently in view.

The public navigation links to a separate admin sign-in page. The admin page shares the Poppins Bold voice, cool-neutral palette, and blue action color, with compact form rows designed for editing match results, player profiles, club rosters, Team of the Week, news, and uploaded media on desktop and mobile. Each club roster is grouped with its current count and an add action that stops at 15; authentication state and save errors are announced in an accessible status region.

The dashboard and admin page share an accessible light/dark switch. The selected theme is stored in the browser and applied before the page styles load to avoid a flash of the wrong theme.

The public dashboard includes a saved notification feed and an opt-in Firebase push switch beside its heading. Permission is requested only after the visitor activates it; status feedback explains setup, browser support, and delivery state.

## Elevation & Depth

Use soft, offset shadows for the floating responsive previews; give tables and match cards lighter elevation. Restrict translucency and blur to the device showcase, where it separates the responsive mockups from their pale-blue ambient field.

## Shapes

Panels use 14–15px corners; compact controls use 8–10px. Borders are cool and low-contrast. Reserve pill shapes for the small season status.

## Components

- Navigation uses small, consistent outlined SVG icons, text labels, and an active state that tracks the current section.
- Match results show week and final status, both clubs, scores, and an optional factual match note.
- The league table, scorer list, and assists empty state share one content region and accessible pressed-state tabs.
- Club marks use supplied Seirin, Alhamdulillah, Psychoriders, and Blue Lock logos where available and team-color initials otherwise.
- Club cards disclose the entered squad names on demand and keep an honest empty state until names are supplied; rosters are capped at 15 players per club.
- Player profile panels pair an admin-supplied portrait and position with apps, goals, assists, and combined G/A; team cards show records calculated from results.
- Team of the Week uses a formation-shaped pitch with an admin-selected XI; the empty state does not imply a lineup before selection.
- News uses factual admin-authored headlines and summaries with optional uploaded photography; no sample stories are fabricated.
- Player, club, and news image uploads use the authenticated admin surface and the public-read Supabase Storage bucket.
- Published posts create persistent notification records with title, summary, timestamp, and a deep link. Firebase Cloud Messaging alerts are opt-in; device tokens stay private to Supabase Edge Functions.
- The desktop preview shows dynamically calculated standings; the overlapping mobile preview shows a real match result.

## Do's and Don'ts

- Keep league results, standings, scorer totals, assist status, roster names, profiles, news, and Team of the Week faithful to `league-data.js` and the saved league data; do not invent player names, live data, or organizer controls.
- Use blue gradients and glass only to frame the responsive preview, never behind small body copy.
- Preserve supplied logos, the Master League name, and the orange identity.
- Prefer real values and clear tables over speculative analytics, decorative charts, or filler metrics.
- Do not invent player testimonials or unverified league claims.
- Respect reduced-motion preferences and keep keyboard focus visible.
