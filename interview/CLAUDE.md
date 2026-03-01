# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReCode is a learning management tool designed for 八股文 (Chinese interview knowledge questions) with a Monaco Editor-based note editor and Spaced Repetition System (SRS) for optimal review scheduling. It features dual-pane Markdown notes with LaTeX support and visualized learning insights.

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint

# Database (SQLite with Prisma)
npx prisma generate  # Generate Prisma client (required after schema changes)
npx prisma db push   # Push schema to database
npx prisma studio    # Open database UI in browser

# Data Import
npm run import:bagu  # Import 八股文 questions from 33.txt (see scripts/import-bagu.ts)
```

## Architecture

### Core Technologies
- **Next.js 16** with App Router
- **TypeScript 5**
- **SQLite + Prisma ORM** for database
- **Monaco Editor** (@monaco-editor/react) for code editing
- **Tailwind CSS 4** + **Radix UI** + **shadcn/ui** for UI
- **Zustand** for state management
- **Framer Motion** for animations
- **Recharts** for visualizations

### Path Aliases
`@/*` maps to `./src/*` (configured in tsconfig.json)

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/actions/` | Server Actions (API layer) - leetcode.ts, questions.ts, review.ts, etc. |
| `src/app/` | Next.js pages using App Router |
| `src/components/` | React components (home, layout, questions, review, shared, ui) |
| `src/lib/` | Core utilities - db.ts (Prisma client), srs.ts (SRS algorithm), utils.ts |
| `src/store/` | Zustand state stores |
| `prisma/` | Database schema and SQLite file (dev.db) |
| `scripts/` | Utility scripts for data import and formatting |

### Main Routes

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/home` |
| `/onboarding` | First-time user setup |
| `/home` | Dashboard with stats and focus tasks |
| `/questions` | Question list management |
| `/questions/add` | Add new question |
| `/questions/[id]` | Edit question with Monaco Editor |
| `/review` | SRS review session |
| `/help` | Help documentation |

### Database Schema (Prisma)

- **User**: Identity and preferences (UI language, theme, daily review limit for 八股文)
- **Problem**: 八股文 question metadata (category/platform, question ID, title, difficulty, tags, standard answer)
- **Progress**: Learning state linking User and Problem (mastery level, SRS data: interval, easiness, next review date, personal notes)
- **Submission**: User's answer attempts or notes (kept for compatibility, mainly used for personal notes)

### Spaced Repetition System (SRS)

Located in `src/lib/srs.ts` - a modified SM-2 algorithm with:
- **Mastery Levels**: System supports 0-5, but 八股文 review UI uses 0=不记得 (Don't remember), 2=模糊 (Vague), 4=记得 (Remember clearly)
- **Fuzzing**: Random 5% variance for intervals > 10 days
- **Graduation threshold**: 365 days (interval)
- **Minimum E-Factor**: 1.3

## Development Notes

- Use Server Actions in `src/actions/` for all API operations
- UI components follow shadcn/ui patterns in `src/components/ui/`
- All database access goes through Prisma client from `src/lib/db.ts`
- Review session logic is in `src/actions/review.ts` and `src/components/review/`
- Data import scripts in `scripts/` directory:
  - `import-bagu.ts`: Imports 八股文 questions from text files (format: platform line, question lines ending with ?, followed by answer text)
  - `format-bagu.ts`: Formatting utilities for 八股文 data