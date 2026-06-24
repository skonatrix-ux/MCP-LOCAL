# MCP-LOCAL Project

## Canva (Pro Account)
- Always save ALL Canva work to the folder **"claude mcp canva"** (folder ID: `FAHNctL9ySU`)
- User has Canva Pro — use any Pro features freely (premium templates, brand kits, exports, etc.)
- When creating designs, move them to this folder using `move-item-to-folder` with folder ID `FAHNctL9ySU`

## Active Tools & Integrations
- **Canva MCP**: Design creation, brand templates, exports — Pro account
- **HIGGSFIELD MCP**: AI video, image, and audio generation
- **Framer MCP**: Web design and CMS
- **Gmail MCP**: Email drafts and management
- **GitHub MCP**: Repo management (scoped to skonatrix-ux/MCP-LOCAL)

## Agents
Custom sub-agents are in `.claude/agents/`. Use them automatically when the task matches:
- `visual-storyteller` — video/animation storyboards and narrative planning
- `image-prompt-engineer` — AI image generation prompts (HIGGSFIELD, Midjourney, etc.)
- `ui-designer` — component libraries, design tokens, Framer UI
- `brand-guardian` — brand identity, voice, visual systems
- `frontend-developer` — React, Remotion, TypeScript, accessibility
- `rapid-prototyper` — MVPs and demos fast
- `prompt-engineer` — LLM system prompt design and testing
- `mcp-builder` — MCP server development
- `software-architect` — system design, ADRs, trade-offs
- `content-creator` — scripts, copy, editorial calendars
- `video-optimization-specialist` — YouTube SEO, thumbnails, retention
- `studio-producer` — multi-project portfolio management
- `agents-orchestrator` — coordinates all agents in quality-gated pipelines
- `reality-checker` — evidence-based QA, defaults to "NEEDS WORK"

## Video / Remotion
- Project uses Remotion 4.x for programmatic video
- `npm start` — opens Remotion Studio
- `npm run build` — renders to `out/video.mp4`
- Root composition: `src/Root.jsx`, scenes in `src/scenes/`

## Git
- Working branch: `claude/optimistic-franklin-gj60a1`
