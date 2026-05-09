# Resgrid Unit — AI Coding Guidelines

> **Resgrid Unit** is a multi-platform emergency response mobile application built with TypeScript, React Native, Expo (managed + prebuild), targeting iOS, Android, Web, and Electron.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 (managed, prebuild) |
| Language | TypeScript (strict mode) |
| Routing | Expo Router (file-based, typed routes) |
| State | Zustand (with MMKV persistence) |
| Data Fetching | @tanstack/react-query (v5) + Axios |
| Forms | react-hook-form + zod validation |
| i18n | react-i18next (9 languages) |
| UI Components | gluestack-ui (`src/components/ui/`) |
| Styling | NativeWind / Tailwind CSS |
| Icons | lucide-react-native (use directly, NOT via gluestack Icon wrapper) |
| Maps | @rnmapbox/maps |
| Realtime | @microsoft/signalr |
| Voice/Video | LiveKit (@livekit/react-native) |
| Storage | react-native-mmkv (local), expo-secure-store (sensitive) |
| Logging | Custom singleton → react-native-logs + @sentry/react-native |
| Push | @notifee/react-native, @react-native-firebase/messaging |
| Package Manager | yarn (v1 classic) |

---

## Project Structure

```
src/
├── api/                  # API layer (organized by domain)
│   ├── common/           # Shared: axios client, cached client, API provider
│   ├── calls/            # Call endpoints (calls.ts, callNotes.ts, etc.)
│   └── ...               # Other domain API modules
├── app/                  # Expo Router file-based routes
│   ├── _layout.tsx       # Root layout (providers, Sentry wrapper)
│   ├── (app)/            # Authenticated tab group
│   ├── call/             # Call screens ([id].tsx, new/, edit)
│   ├── login/            # Login & SSO screens
│   └── maps/             # Map screens (custom, indoor, search)
├── components/           # Shared components
│   ├── ui/               # gluestack-ui component library
│   ├── common/           # Cross-feature shared components
│   └── [domain]/         # Domain-specific components (maps, calls, etc.)
├── constants/            # App constants (colors, map icons)
├── features/             # Feature-specific modules (livekit-call)
├── hooks/                # Custom React hooks
├── lib/                  # Core utilities & services
│   ├── auth/             # Auth API, types, and utilities
│   ├── cache/            # Cache manager for API responses
│   ├── i18n/             # Internationalization setup
│   ├── logging/          # Logging singleton (→ Sentry)
│   ├── storage/          # MMKV storage + Zustand adapter
│   └── native-modules/   # Platform-specific native module wrappers
├── models/               # TypeScript types for API responses (v4/)
├── providers/            # React context providers
├── services/             # Singleton services (signalr, push, audio, location, etc.)
├── stores/               # Zustand stores (organized by domain)
│   ├── auth/             # Auth store (login, tokens, profile)
│   ├── app/              # Core app state, lifecycle, location, audio, bluetooth
│   ├── calls/            # Calls state
│   └── ...               # Other domain stores
├── translations/         # i18n JSON files (en, es, fr, de, it, pl, sv, uk, ar)
├── types/                # Shared TypeScript type definitions
└── utils/                # Pure utility functions
```

---

## Path Aliases

Configured in `tsconfig.json` — **always use these** instead of relative paths:

| Alias | Maps To |
|---|---|
| `@/*` | `./src/*` |
| `@env` | `./src/lib/env.js` |
| `@assets/*` | `./assets/*` |

```typescript
// ✅ Correct
import { logger } from '@/lib/logging';
import { Env } from '@env';

// ❌ Wrong
import { logger } from '../../lib/logging';
```

---

## Code Style & Conventions

### TypeScript

- **Strict mode** is enabled. Never use `any`; prefer precise types and interfaces.
- Use `interface` for props and state definitions.
- Use `type` imports for type-only imports (enforced by ESLint):
  ```typescript
  import type { CallResult } from '@/models/v4/calls/callResult';
  ```

### Components

- **Functional components only** — never class components.
- Use `React.FC<Props>` for typed components.
- **All components must be mobile-friendly and responsive** across iOS and Android.
- This is an Expo managed project using prebuild — **do NOT make native code changes** outside Expo prebuild capabilities.

### Naming

| Kind | Convention | Example |
|---|---|---|
| Variables / functions | `camelCase` | `isFetchingData`, `handleUserInput` |
| Components | `PascalCase` | `UserProfile`, `ChatScreen` |
| Files / directories | `lowercase-hyphenated` | `user-profile.tsx`, `chat-screen/` |
| Zustand stores | `use[Domain]Store` | `useAuthStore`, `useCoreStore`, `useCallsStore` |
| API modules | `camelCase` exports | `getCalls()`, `createCall()`, `getCall()` |

### Conditional Rendering

**Always use ternary `? :` — never use `&&`** for conditional rendering:

```tsx
// ✅ Correct
{isLoading ? <Spinner /> : <Content />}

// ❌ Wrong — can render "false" or "0" as text
{isLoading && <Spinner />}
```

### Imports

ESLint enforces `simple-import-sort` with this grouping order:
1. Side-effect imports (e.g., `import '../../global.css'`)
2. External packages (react, expo, third-party)
3. Internal aliases (`@/`, `@env`, `@assets/`)
4. Relative imports
5. Type imports

---

## API Layer Pattern

All API modules follow a consistent pattern using `createApiEndpoint` and `createCachedApiEndpoint`:

```typescript
// src/api/calls/calls.ts
import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

// Cached endpoint (auto-invalidates via cacheManager)
const callsApi = createCachedApiEndpoint('/Calls/GetActiveCalls', {
  ttl: 30 * 1000, // 30 seconds
  enabled: true,
});

// Simple endpoint
const getCallApi = createApiEndpoint('/Calls/GetCall');

export const getCalls = async () => {
  const response = await callsApi.get<ActiveCallsResult>();
  return response.data;
};
```

**Key rules:**
- The Axios client (`src/api/common/client.tsx`) handles auth token injection and automatic 401 refresh via interceptors.
- Always use the typed generic `<ResponseType>` on `.get<T>()`, `.post<T>()`, etc.
- After mutations (create/update/delete), invalidate relevant caches via `cacheManager.remove()`.
- API response models live in `src/models/v4/` organized by domain.

---

## State Management (Zustand)

Stores use Zustand with MMKV persistence:

```typescript
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

interface MyState {
  data: SomeType | null;
  isLoading: boolean;
  fetchData: () => Promise<void>;
}

export const useMyStore = create<MyState>()(
  persist(
    (set, get) => ({
      data: null,
      isLoading: false,
      fetchData: async () => {
        set({ isLoading: true });
        try {
          const result = await someApiCall();
          set({ data: result, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          logger.error({ message: 'Failed to fetch', context: { error } });
        }
      },
    }),
    {
      name: 'my-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        // Only persist what's needed; exclude transient flags like isLoading
        data: state.data,
      }),
    }
  )
);
```

**Key rules:**
- Use `partialize` to exclude transient state (loading, error flags) from persistence.
- Access store outside React via `useMyStore.getState()` (e.g., in services or interceptors).
- Cross-store interactions use `useOtherStore.getState()` — avoid circular dependencies.

---

## Services (Singleton Pattern)

Services like `SignalRService` and `LogService` use the singleton pattern:

```typescript
class MyService {
  private static instance: MyService | null = null;
  private constructor() {}

  public static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }

  // ... methods
}

export const myService = MyService.getInstance();
```

---

## Styling

- **Primary**: Use `gluestack-ui` components from `src/components/ui/` when available.
- **Tailwind/NativeWind**: For utility-first styling via `className` props.
- **Fallback**: Use `StyleSheet.create()` for styles without a gluestack equivalent.
- **Dark mode + light mode** must be supported — the app responds to system color scheme via `useColorScheme()`.
- **Colors**: Use semantic color tokens from Tailwind config (`primary`, `secondary`, `background`, `typography`, etc.), not hardcoded hex values.

---

## Internationalization (i18n)

**All user-visible text MUST be wrapped in `t()`** from `react-i18next`:

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <Text>{t('calls.noActiveCalls')}</Text>;
```

- Translation files: `src/translations/*.json` (en.json is the source of truth)
- Supported: en, es, fr, de, it, pl, sv, uk, ar
- Translation keys are enforced to be sorted alphabetically and identical across files (ESLint plugin)
- Use interpolation for dynamic values: `t('greeting', { name: user.name })`

---

## Environment Variables

Managed via `env.js` with Zod validation. Four environments: `development`, `staging`, `internal`, `production`.

- **Client vars** (used in `src/`): Import via `import { Env } from '@env'`
- **Build-time vars** (used in `app.config.ts`): Accessed directly in `env.js`
- Each environment has a `.env.{APP_ENV}` file at project root.
- New variables must be added to both the Zod schema AND the corresponding object in `env.js`.

---

## Testing

- **Framework**: Jest with `jest-expo` preset
- **Utilities**: `@testing-library/react-native`
- **Test location**: `__tests__/` directories co-located with source files
- **Test naming**: `*.test.tsx` or `*.test.ts`

```bash
yarn test              # Run all tests
yarn test:watch        # Watch mode
yarn test:ci           # CI mode with coverage
```

**Test conventions:**
- Mock native modules at the top of test files (before imports).
- Mock stores, services, and hooks using `jest.mock()`.
- Use `TestWrapper` components for providers.
- Always call `unmount()` in tests to clean up.
- Use `jest.useFakeTimers()` / `jest.useRealTimers()` for time-dependent tests.
- Generate tests for all new components, services, and logic.

---

## Linting & Formatting

```bash
yarn lint              # ESLint (src/**/*.ts,tsx)
yarn type-check        # tsc --noemit
yarn lint:translations # Validate i18n JSON files
yarn check-all         # Run all three
```

**Prettier config:**
- Single quotes
- Trailing commas (ES5)
- Print width: 220
- Auto line endings

**ESLint highlights:**
- `@typescript-eslint/consistent-type-imports`: Enforces `import type` for type-only imports
- `simple-import-sort`: Enforces import ordering
- `react-compiler`: React Compiler plugin enabled
- Max function length: 1500 lines
- Max function params: 10 (use an object parameter instead)

---

## Git & Commits

**Conventional Commits** (enforced by commitlint):

```
feat: add call priority filtering
fix: prevent token refresh race condition
refactor: extract location service into singleton
chore: update Expo SDK to 54
```

---

## Platforms

The app runs on **four platforms**. Use platform utilities from `src/lib/platform.ts`:

```typescript
import { isWeb, isNative, isIOS, isAndroid, isElectron, isDesktop } from '@/lib/platform';
```

Platform-specific files use the extension pattern:
- `callkeep.service.ios.ts` / `callkeep.service.android.ts` / `callkeep.service.web.ts`
- React Native / Metro resolves these automatically based on platform.

---

## Key Libraries — Use These, Not Alternatives

| Purpose | Library | Notes |
|---|---|---|
| HTTP | `axios` | Via `createApiEndpoint` / `createCachedApiEndpoint` |
| State | `zustand` | With MMKV persistence |
| Data fetching | `@tanstack/react-query` | Wraps API calls for caching/invalidation |
| Forms | `react-hook-form` | With `@hookform/resolvers` + `zod` |
| i18n | `react-i18next` | All text in `t()` |
| Local storage | `react-native-mmkv` | Via `@/lib/storage` |
| Secure storage | `expo-secure-store` | For tokens/credentials |
| Maps | `@rnmapbox/maps` | Mapbox GL for all mapping |
| Icons | `lucide-react-native` | Use directly, NOT via gluestack Icon |
| Animations | `react-native-reanimated` + `@legendapp/motion` | |
| Bottom sheets | `@gorhom/bottom-sheet` | |
| Lists | `@shopify/flash-list` | For performant lists |
| Dates | `date-fns` | |
| Error tracking | `@sentry/react-native` | Errors auto-reported via logger |

---

## Logging

Use the shared logger singleton — **never use `console.log`** for production code:

```typescript
import { logger } from '@/lib/logging';

logger.info({ message: 'User logged in', context: { userId } });
logger.warn({ message: 'Slow response', context: { duration } });
logger.error({ message: 'API call failed', context: { error } });
```

- `logger.error()` automatically reports to Sentry.
- Sensitive keys (tokens, passwords, emails) are automatically redacted from context.
- In tests, logging is automatically disabled.

---

## Performance Guidelines

- Minimize `useEffect`, `useState`, and heavy computation inside render methods.
- Use `React.memo()` for components with static props.
- Optimize `FlatList` / `FlashList` with `removeClippedSubviews`, `maxToRenderPerBatch`, `windowSize`, and `getItemLayout` when items have consistent size.
- Avoid anonymous functions in `renderItem` or event handlers.
- Optimize for low-end devices.

---

## Accessibility

- Follow WCAG guidelines for mobile.
- Use semantic components and accessible labels.
- Ensure sufficient color contrast in both light and dark mode.

---

## Error Handling

- Handle errors gracefully and provide user feedback via toast notifications (`useToastStore`).
- API errors are handled by Axios interceptors (auto-logout on auth failure).
- Services implement retry logic with exponential backoff where appropriate.
- All async operations should have proper try/catch with logging.


## Agent Coding

- Always use the hindsight recall tool before answering coding questions. 
- Always retain important project information using hindsight retain.