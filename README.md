# ⬡ VisualGit — Browser-Based Interactive Git Repository Explorer & Operations Lab

> A full-stack web application that transforms any public GitHub repository into an interactive, visual commit graph — plus an integrated Git Operations Lab that simulates cherry-pick, rebase, merge, and conflict resolution with real-time graph updates.

### **[🚀 Live Demo → web-production-0f401.up.railway.app](https://web-production-0f401.up.railway.app)**

---

## 🎯 What is VisualGit?

Every developer uses Git daily, but most interact with it through cryptic terminal commands. **VisualGit** brings Git history to life — turning abstract commit hashes and branch pointers into a navigable, interactive graph.

The app has two modes:

**🔍 Explore Mode** — Paste any public GitHub repo URL and instantly visualize its commit DAG, branch relationships, file-level diffs, and side-by-side commit comparisons.

**🧪 Git Lab Mode** — An interactive simulator that demonstrates how cherry-pick, interactive rebase, merge, and conflict resolution work internally — with animated graph updates, step-by-step explanations, and a 3-panel conflict resolver.

Think of it as an open-source, browser-based alternative to [GitKraken](https://www.gitkraken.com/) or [Sourcetree](https://www.sourcetreeapp.com/) — with zero installation and a built-in teaching tool.

---

## ✨ Features

### 🔀 Interactive Commit Graph
- **D3.js-powered** vertical DAG visualization with branch-colored lanes
- **Zoom & Pan** — scroll to zoom, drag to pan with grab cursor, +/− controls and reset button
- **Hover tooltips** — mouse over any node to preview SHA, author, and message
- **Click-to-glow** — selected commits highlight with an animated glow ring
- **Merge visualization** — cross-branch merges rendered as smooth Bézier curves
- **Commit messages** displayed inline next to each node with author and timestamp

### 📝 Diff Viewer
- Click any commit to open a **slide-over diff panel**
- **File-by-file breakdown** with status badges: Added (A), Modified (M), Deleted (D), Renamed (R)
- **Syntax-highlighted patches** — green for additions, red for deletions, purple for chunk headers
- **Collapsible file sections** — expand only what you need
- **Stats summary** — total additions, deletions, and file count

### ⚖️ Commit Comparison
- Toggle **Compare Mode** to diff any two commits
- Select commit **A** and **B** from the graph or list view
- See **ahead/behind counts**, commits in range, and full file-level diff
- Works across branches — compare a feature branch tip to main

### 🧪 Git Operations Lab (Interactive Simulator)

A built-in learning environment that visually demonstrates Git's most important operations:

#### 🍒 Cherry-Pick Simulator
- Visual simulation showing how a commit gets copied to another branch
- Animated arrow displaying source → target flow
- New commit appears with a different SHA, demonstrating that cherry-pick creates a copy
- Detailed explanation of what Git does internally (diff computation, new commit creation, parent reassignment)

#### 📐 Interactive Rebase Simulator
- **Drag-and-drop UI** to reorder commits
- Action selector for each commit: **Pick**, **Reword**, **Squash**, **Drop**
- Visual before/after graph showing rewritten history with new SHAs
- Explains why rebase rewrites history and when it's safe to use

#### 🔀 Merge Simulator
- Shows how a merge commit gets created with **two parents**
- Visualizes the difference between fast-forward and three-way merge
- Animated graph update showing the new merge commit appearing
- Explains merge strategies and when conflicts arise

#### ⚔️ Conflict Resolution Simulator
- **3-panel merge view**: Ours (HEAD) / Base (ancestor) / Theirs (incoming)
- Click any version to select it, or **write custom resolution** in the editor
- Stage the resolved file and complete the merge
- Explains conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and resolution workflow

### 📊 Repository Insights
- **Stars, forks, contributors, branch count** at a glance
- **Owner avatar and description** pulled from GitHub API
- **Branch filtering** — isolate any branch to focus the graph
- **Commit search** — filter by message, author name, or SHA hash

### 📱 Responsive Design
- Adapts to **desktop, tablet, and mobile** screens
- Branch pills collapse on small viewports
- Diff panels go full-width on mobile
- Touch-friendly zoom and pan on tablets

### 🎨 Visual Polish
- **Animated particle background** with grid lines and connecting nodes
- **Glassmorphism UI** with backdrop blur and translucent panels
- **Gradient accents** and smooth transitions throughout
- **Dark theme** optimized for extended use

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (React 19)                 │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              🔍 Explore Mode                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ D3.js v7 │ │ Commit   │ │  Compare     │ │   │
│  │  │ Commit   │ │ List +   │ │  Panel +     │ │   │
│  │  │ Graph    │ │ Search   │ │  Diff View   │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │              🧪 Git Lab Mode                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ Sim      │ │ Rebase   │ │  Conflict    │ │   │
│  │  │ Graph    │ │ Reorder  │ │  Resolver    │ │   │
│  │  │ (D3.js)  │ │ UI       │ │  (3-panel)   │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
│           Vite 8 (Dev Server + Build)                │
└────────────────────────┬────────────────────────────┘
                         │ /api/*
┌────────────────────────▼────────────────────────────┐
│                  Server (Express 5)                  │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │           GitHub API Proxy Layer                │ │
│  │                                                 │ │
│  │  GET /api/repo/:owner/:repo          Repo info  │ │
│  │  GET /api/repo/:owner/:repo/branches Branches   │ │
│  │  GET /api/repo/:owner/:repo/commits  Commits    │ │
│  │  GET /api/repo/:owner/:repo/commits/:sha  Diff  │ │
│  │  GET /api/repo/:owner/:repo/compare  Compare    │ │
│  │  GET /api/repo/:owner/:repo/tree/:sha File tree │ │
│  │  GET /api/repo/:owner/:repo/contributors  Users │ │
│  │  GET /api/rate-limit            Rate limit info  │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│        + Static file serving (production)            │
└────────────────────────┬────────────────────────────┘
                         │
                ┌────────▼────────┐
                │  GitHub REST    │
                │    API v3       │
                └─────────────────┘
```

---

## 🛠️ Tech Stack

| Layer          | Technology        | Purpose                                                |
|----------------|-------------------|--------------------------------------------------------|
| Frontend       | React 19          | Component-based UI with hooks for state management     |
| Visualization  | D3.js v7          | SVG-based interactive commit graphs with zoom/pan      |
| Bundler        | Vite 8            | Sub-second HMR in dev, optimized production builds     |
| Backend        | Express.js 5      | Lightweight API proxy with structured error handling   |
| API            | GitHub REST v3    | Commits, branches, diffs, comparisons, contributors   |
| Deployment     | Railway           | Auto-deploy from GitHub with zero configuration        |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and **npm** 9+
- (Optional) [GitHub Personal Access Token](https://github.com/settings/tokens) for higher rate limits

### Local Development

```bash
# Clone
git clone https://github.com/heetgoti22-bit/visual-git-client.git
cd visual-git-client

# Install all dependencies (root + client + server)
npm install

# Start backend (Terminal 1)
cd server && npm run dev

# Start frontend (Terminal 2)
cd client && npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies API calls to Express on port 3001.

### Production Build

```bash
npm run build    # Builds the Vite client into client/dist/
npm start        # Express serves the built frontend + API
```

---

## 📁 Project Structure

```
visual-git-client/
├── client/                       # React frontend
│   ├── src/
│   │   ├── App.jsx               # Main app — graph, list, diff, compare
│   │   ├── GitSimulator.jsx      # Git Lab — cherry-pick, rebase, merge, conflict sim
│   │   └── main.jsx              # Entry point with global styles
│   ├── index.html
│   ├── vite.config.js            # Vite config with API proxy
│   └── package.json
├── server/
│   ├── server.js                 # Express API — 8 GitHub proxy endpoints
│   └── package.json
├── package.json                  # Root — orchestrates install, build, start
├── Procfile                      # Railway process definition
├── .gitignore
├── .env.example
└── README.md
```

---

## 🌐 Deployment

### Railway (Recommended)

1. Push code to GitHub
2. Connect the repo at [railway.app](https://railway.app)
3. Add environment variable: `GITHUB_TOKEN` = your token
4. Railway auto-runs: `npm install` → `npm run build` → `npm start`
5. Get your public URL

### Other Platforms

Works on any platform that supports Node.js: **Render**, **Fly.io**, **Heroku**, **Vercel** (with serverless adapter), or **Docker**.

---

## 🔑 GitHub Token

Without a token, GitHub limits you to **60 API requests/hour**. With a token, you get **5,000/hour**.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate a **Classic** token with `public_repo` scope
3. Either paste it in the app's 🔑 field, or set it as `GITHUB_TOKEN` env variable

---

## 🧠 Technical Highlights

**Git internals mastery** — The Git Lab simulator demonstrates deep understanding of DAGs, commit parent relationships, SHA rewriting during rebase, three-way merge algorithms, and conflict marker resolution.

**D3.js advanced usage** — Custom SVG rendering with zoom/pan behaviors, animated hover states, Bézier curves for merge lines, dynamic layout calculation, glow filters, and interactive tooltips.

**3-panel conflict resolver** — A visual merge tool showing ours/base/theirs side-by-side with the ability to select a version or write custom resolution — mirroring professional tools like VS Code's merge editor.

**Interactive rebase UI** — Drag-and-drop commit reordering with pick/reword/squash/drop actions, demonstrating how Git rewrites history and generates new SHAs.

**API design** — Clean proxy layer that normalizes GitHub's API responses, handles rate limiting gracefully, and supports optional authentication via headers.

**Full-stack deployment** — Monorepo with unified build pipeline: Vite builds the client, Express serves it alongside the API, Railway deploys everything from a single `npm start`.

---

## 🗺️ Roadmap

- [ ] AI-powered commit message summarization
- [ ] File tree explorer with syntax-highlighted code viewer
- [ ] GitLab and Bitbucket support
- [ ] Dark/light theme toggle
- [ ] Export graph as SVG/PNG
- [ ] Keyboard shortcuts for navigation
- [ ] Pull request visualization
- [ ] Drag-and-drop cherry-pick on live repos (with GitHub OAuth)

---

## 📄 License

MIT — free for personal and commercial use.

---

**Built by [Heet Goti](https://github.com/heetgoti22-bit)**