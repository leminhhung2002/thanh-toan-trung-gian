# Admin Mobile Sidebar Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile toggle button to the admin dashboard so the sidebar can be opened and closed on small screens.

**Architecture:** Keep the existing desktop sidebar intact and add a small UI state in `AdminShell` for mobile-only visibility. The toggle button lives in the existing top bar, the sidebar gets an open/closed class, and selecting a tab or logging out closes the mobile menu to preserve screen space.

**Tech Stack:** React 19, TanStack Query/Router, CSS modules, Vitest

---

### Task 1: Cover The New Mobile Toggle Contract

**Files:**
- Modify: `client/src/features/admin/admin-layout.test.ts`
- Test: `client/src/features/admin/admin-layout.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that the admin page source contains:
- a mobile toggle button hook/class
- a closed/open sidebar class split for mobile
- a close-on-select hook on nav buttons

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client test -- admin-layout.test.ts`
Expected: FAIL because the current admin shell does not expose mobile toggle markup/classes yet.

- [ ] **Step 3: Write minimal implementation**

Update `client/src/features/admin/admin-page.tsx` to:
- add `isMobileSidebarOpen` state
- render a toggle button in the top bar
- apply an open class to the sidebar
- close the sidebar when a tab is selected or logout is triggered

Update `client/src/routes/admin.module.css` to:
- hide the sidebar by default on mobile
- show it when the open class is present
- style the toggle button for mobile only

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter client test -- admin-layout.test.ts`
Expected: PASS

- [ ] **Step 5: Run a broader regression check**

Run: `pnpm --filter client test -- ui.test.ts admin-layout.test.ts`
Expected: PASS
