# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fans and players who want to follow Master League results, standings, clubs, and player stats.

## Product Purpose

Provide a public, read-only home for Master League information. Visitors should be able to quickly understand recent results and the current league picture.

## Capabilities and Constraints

- The public site is static HTML, CSS, and JavaScript; Supabase supplies persisted league data and authenticated organizer writes.
- Anyone can read the public league data. Only user accounts explicitly allowlisted in Supabase can edit it; standings are calculated from match results.
- Visitors can filter results by week and switch between standings, top scorers, and assists.
- Admins can maintain a roster of up to 15 named players per club; public club cards show only the names entered by an admin.
- Player profiles show admin-maintained positions and appearances alongside goal and assist totals; G/A is calculated from those totals.
- Club records are calculated from match results. Admins choose an eleven-player Team of the Week in a 4-3-3, 4-4-2, or 3-5-2 formation.
- Allowlisted admins can upload player, club, and news photos to the public-read, admin-write Supabase Storage bucket.
- Admins can publish league news items with a headline, announcement, and optional photo.
- Visitors can switch between light and dark display themes; their choice is shared by the league and admin pages and saved in this browser.
- Visitors can read a persistent notification history of published posts and opt into Firebase Cloud Messaging alerts on each supported browser/device.
- Current content covers Weeks 01–02 and should remain factual; do not invent fixtures, statistics, or club details.

## Brand Commitments

- Preserve the Master League name, existing league logo, and supplied team logos.
- Use the supplied Master League logo as the league identity, complemented by a clean white and cool-neutral analytics direction with restrained blue accents.

## Evidence on Hand

- Initial league results and scorers are supplied in `league-data.js`; live results and player statistics are stored in Supabase.
- Club rosters begin empty and are stored in the existing Supabase JSON payload; no player names have been supplied.
- No Team of the Week, news items, or new player/team photos have been supplied; these remain empty until admins add them.
- Master League, FC Seirin, FC Alhamdulillah, Psychoriders, and Blue Lock FC logo assets are in `assets/`.
- Official assists have not been supplied; keep the list empty until confirmed.
- Supabase setup, account allowlisting, and row-level security are documented in `SUPABASE_SETUP.md`.

## Product Principles

- Make the league picture easy to scan.
- Keep scores and statistics faithful to the supplied data.
- Give every club and player equal clarity and respect.
