import os
import sys

# Determine project root: use CLI argument if provided, otherwise compute from script location
if len(sys.argv) > 1:
    project_root = os.path.abspath(sys.argv[1])
else:
    # Script is in scripts/, so go up one level to get project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Patch 1: Fix color-scheme.js leading-space bug
color_scheme_path = os.path.join(
    project_root,
    'node_modules', 'react-native-css-interop', 'dist', 'runtime', 'web', 'color-scheme.js'
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
    project_root,
    'node_modules', 'react-native-css-interop', 'dist', 'runtime', 'web', 'useColorScheme.js'
)

# Read existing file and perform targeted replacement with safety checks
with open(use_color_scheme_path, 'r') as f:
    use_color_scheme_content = f.read()

# Verify the file matches expected structure before patching
if 'function useColorScheme()' not in use_color_scheme_content:
    print("ERROR: useColorScheme.js does not contain expected 'function useColorScheme()' signature.")
    print("File may have been updated upstream. Skipping patch to avoid overwriting unexpected changes.")
    sys.exit(1)

if 'colorScheme: color_scheme_1.colorScheme.get(effect)' not in use_color_scheme_content:
    print("ERROR: useColorScheme.js does not contain expected return structure.")
    print("File may have been updated upstream. Skipping patch to avoid overwriting unexpected changes.")
    sys.exit(1)

# Check if already patched
if 'cleanupEffect' in use_color_scheme_content and 'prevEffect.current' in use_color_scheme_content:
    print("useColorScheme.js already patched (cleanupEffect logic present)")
else:
    # Targeted replacement: Add prevEffect cleanup logic after useState declaration
    old_effect_pattern = '''function useColorScheme() {
    const [effect, setEffect] = (0, react_1.useState)(() => ({
        run: () => setEffect((s) => ({ ...s })),
        dependencies: new Set(),
    }));
    return {'''
    
    new_effect_pattern = '''function useColorScheme() {
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
    return {'''
    
    if old_effect_pattern in use_color_scheme_content:
        use_color_scheme_content = use_color_scheme_content.replace(old_effect_pattern, new_effect_pattern)
        
        with open(use_color_scheme_path, 'w') as f:
            f.write(use_color_scheme_content)
        
        print("Patched useColorScheme.js (added cleanup logic)")
    else:
        print("ERROR: useColorScheme.js structure does not match expected pattern.")
        print("Expected pattern not found. File may have been updated upstream.")
        print("Skipping patch to avoid overwriting unexpected changes.")
        sys.exit(1)

# Patch 3: Fix api.js direct baseComponent.render() / baseComponent() calls
# that break under React 19 (hooks run on wrong fiber)
api_path = os.path.join(
    project_root,
    'node_modules', 'react-native-css-interop', 'dist', 'runtime', 'web', 'api.js'
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
