import os

# Patch 1: Fix color-scheme.js leading-space bug
color_scheme_path = os.path.join(
    '/Volumes/USBSSD/dev/Resgrid/Unit',
    'node_modules/react-native-css-interop/dist/runtime/web/color-scheme.js'
)

with open(color_scheme_path, 'r') as f:
    content = f.read()

# Fix: trim the darkModeFlag to handle leading space from getPropertyValue
old = 'const darkModeFlag = stylesheet_1.StyleSheet.getFlag("darkMode");'
new = 'const darkModeFlag = (stylesheet_1.StyleSheet.getFlag("darkMode") || "").trim();'
content = content.replace(old, new)

# Fix: MutationObserver must not call colorScheme.set() when darkMode is "media"
# because set() throws for media mode. Just record the mode and return.
old_observer = '''        exports.colorScheme.set(globalThis.window.document.documentElement.classList.contains(darkModeValue)
            ? "dark"
            : "system");'''
new_observer = '''        // For "media" mode the browser handles dark mode via CSS media queries;
        // calling set() would throw, so just return after recording the mode.
        if (darkMode === "media")
            return;
        exports.colorScheme.set(globalThis.window.document.documentElement.classList.contains(darkModeValue)
            ? "dark"
            : "system");'''
content = content.replace(old_observer, new_observer)

with open(color_scheme_path, 'w') as f:
    f.write(content)

print(f"Patched color-scheme.js ({content.count('.trim()')} trim calls)")

# Patch 2: Fix useColorScheme.js effect memory leak
use_color_scheme_path = os.path.join(
    '/Volumes/USBSSD/dev/Resgrid/Unit',
    'node_modules/react-native-css-interop/dist/runtime/web/useColorScheme.js'
)

patched_hook = '''"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useColorScheme = useColorScheme;
const react_1 = require("react");
const color_scheme_1 = require("./color-scheme");
const observable_1 = require("../observable");
function useColorScheme() {
    const [effect, setEffect] = (0, react_1.useState)(() => ({
        run: () => setEffect((s) => ({ ...s })),
        dependencies: new Set(),
    }));
    // Clean up stale effects when a new effect object is created to prevent
    // orphaned effects from accumulating in the observable's effects Set.
    const prevEffect = (0, react_1.useRef)(null);
    if (prevEffect.current && prevEffect.current !== effect) {
        (0, observable_1.cleanupEffect)(prevEffect.current);
    }
    prevEffect.current = effect;
    // Also clean up on unmount
    (0, react_1.useEffect)(() => {
        return () => (0, observable_1.cleanupEffect)(effect);
    }, [effect]);
    return {
        colorScheme: color_scheme_1.colorScheme.get(effect),
        setColorScheme: color_scheme_1.colorScheme.set,
        toggleColorScheme: color_scheme_1.colorScheme.toggle,
    };
}
//# sourceMappingURL=useColorScheme.js.map
'''

with open(use_color_scheme_path, 'w') as f:
    f.write(patched_hook)

print("Patched useColorScheme.js")

# Patch 3: Fix api.js direct baseComponent.render() / baseComponent() calls
# that break under React 19 (hooks run on wrong fiber)
api_path = os.path.join(
    '/Volumes/USBSSD/dev/Resgrid/Unit',
    'node_modules/react-native-css-interop/dist/runtime/web/api.js'
)

with open(api_path, 'r') as f:
    api_content = f.read()

api_content = api_content.replace(
    'return baseComponent.render(props, props.ref);',
    'return (0, react_1.createElement)(baseComponent, props);'
)
api_content = api_content.replace(
    'return baseComponent(props);',
    'return (0, react_1.createElement)(baseComponent, props);'
)

with open(api_path, 'w') as f:
    f.write(api_content)

print("Patched api.js (createElement instead of direct calls)")
print("Done!")
