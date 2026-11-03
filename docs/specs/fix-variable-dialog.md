# Assessment: Variable Chip Deselection Bug in Edit Variable Dialog

## Summary

The Cypress test for editing a variable chip fails intermittently because the selected variable becomes `undefined` by the time the edit dialog renders. This happens due to a race condition between the modal opening (which causes the Slate editor to blur) and React re-rendering the toolbar button component.

## Root Cause

The bug is in `EditVariableTextButton` ([text-tile-buttons.tsx:179-208](../src/plugins/shared-variables/slate/text-tile-buttons.tsx#L179-L208)).

The component computes `selectedVariable` **reactively at render time**:

```typescript
const selectedElements = editor?.selectedElements();
const hasVariable = editor?.isElementActive(kVariableFormat);
const selectedVariable = hasVariable ? findSelectedVariable(selectedElements, variables) : undefined;
```

This value is passed to the dialog hook:

```typescript
const [showDialog] = useEditVariableDialog({
  variable: selectedVariable,  // ← This is reactive and can become undefined
  onClose: () => handleClose(editor)
});
```

## The Race Condition Sequence

1. **User clicks variable chip** → Slate selection is set → component re-renders with correct `selectedVariable`
2. **User clicks Edit button** → `handleClick` fires → `showDialog()` called
3. **Modal opens** → Modal takes focus (via `setTimeout` in [use-custom-modal.tsx:70-77](../src/hooks/use-custom-modal.tsx#L70-L77))
4. **Slate editor blurs** → Slate selection is cleared
5. **React re-renders `EditVariableTextButton`** → `selectedVariable` becomes `undefined`
6. **Dialog receives `undefined`** for the variable prop

## Why It's Environment-Dependent

- Chrome/Cypress: Focus/blur events fire with timing that triggers the race condition
- Electron: Different event handling prevents the race condition from manifesting
- The `setTimeout` in the modal's `handleAfterOpen` introduces timing variability

## Current Workaround (in PR)

The test changes from clicking `.variable-chip` to `.variable-name` and adds an assertion to make failures more obvious. However, as the comment in the test notes, this doesn't reliably fix the issue—it just happens to reduce the frequency of failures.

## Proposed Fix: useRef to Preserve Selection

The fix preserves the selected variable in a `useRef` that only updates when a valid selection exists. This prevents the blur-induced re-render from clearing the value:

```typescript
export const EditVariableTextButton = observer(
    function EditVariableTextButton({name}: IToolbarButtonComponentProps) {
  const editor = useSlate();
  const plugins = useContext(TextPluginsContext);
  const pluginInstance = plugins[kVariableTextPluginName];
  const variablesPlugin = castToVariablesPlugin(pluginInstance);

  const isSelected = false;
  const selectedElements = editor?.selectedElements();
  const variables = variablesPlugin?.variables || [];
  const hasVariable = editor?.isElementActive(kVariableFormat);
  const selectedVariable = hasVariable ? findSelectedVariable(selectedElements, variables) : undefined;

  // Preserve the selected variable in a ref so it survives blur-induced re-renders.
  // Only update when we have a valid selection - this prevents the blur from clearing it.
  const selectedVariableRef = useRef<typeof selectedVariable>(undefined);
  if (selectedVariable) {
    selectedVariableRef.current = selectedVariable;
  }

  // Button is disabled based on current selection (reactive)
  const disabled = !selectedVariable;

  // Dialog uses the ref value (preserved across blur)
  const [showDialog] = useEditVariableDialog({
    variable: selectedVariableRef.current,
    onClose: () => handleClose(editor)
  });

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    showDialog();
  };

  return (
    <TileToolbarButton name={name} title="Edit Variable"
      disabled={disabled} selected={isSelected} onClick={handleClick}>
      <VariableEditorIcon/>
    </TileToolbarButton>
  );
});
```

## How the Fix Works

| Aspect | Current (Broken) | Fixed |
|--------|------------------|-------|
| Button disabled state | `!selectedVariable` (reactive) | `!selectedVariable` (reactive) - unchanged |
| Dialog variable prop | `selectedVariable` (reactive, can become undefined) | `selectedVariableRef.current` (preserved) |
| On blur | Variable becomes undefined, dialog breaks | Ref retains last valid value, dialog works |

The key insight is separating two concerns:
- **Button enabled/disabled**: Should be reactive (disabled when nothing selected)
- **Dialog variable**: Should be preserved (the variable that was selected when the button was clicked)

## Testing Considerations

With this fix in place:
1. The test can revert to clicking `.variable-chip` (the original behavior)
2. The explanatory comment about flakiness can be removed
3. The assertion checking the variable name in the dialog can remain as a useful verification

## Files Affected

- **Primary fix**: `src/plugins/shared-variables/slate/text-tile-buttons.tsx`
- **Test cleanup** (after fix): `cypress/e2e/functional/tile_tests/shared_variables_test_spec.js`
