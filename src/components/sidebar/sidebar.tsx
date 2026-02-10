// Re-export the sidebar content for native platforms.
// On web, metro resolves to sidebar.web.tsx instead.
// Using a separate sidebar-content.tsx file breaks the require cycle
// that occurred when sidebar.web.tsx imported './sidebar' — which on web
// resolved back to sidebar.web.tsx itself, causing infinite recursion / OOM.
export { default } from './sidebar-content';
