# Question Tile Implementation Plan

This document outlines the plan for implementing a new QuestionTile type in CLUE.

## File Structure

```
src/
├── components/tiles/question/
│   ├── question-tile.tsx         # Main tile component
│   ├── question-tile.test.tsx    # Component tests
│   └── question-tile.scss        # Styling
└── models/tiles/question/
    ├── question-registration.ts   # Tile registration
    ├── question-content.ts        # Content model
    └── question-content.test.ts   # Model tests
```

## Implementation Steps

### 1. Content Model Layer

#### question-content.ts

```typescript
const QuestionContent = types.model("QuestionContent", {
  type: types.literal("Question"),
  version: types.optional(types.number, 1)
})
```

#### question-content.test.ts

```typescript
describe("QuestionContent", () => {
  it("creates a default question content", () => {
    const content = QuestionContent.create({
      type: "Question"
    })
    expect(content.type).toBe("Question")
    expect(content.version).toBe(1)
  })
})
```

### 2. Registration Layer

#### question-registration.ts

```typescript
export const QuestionContentInfo: ITileContentInfo = {
  type: "Question",
  modelClass: QuestionContent,
  componentClass: QuestionTileComponent
}
```

### 3. Component Layer

#### question-tile.tsx

```typescript
export const QuestionTileComponent: React.FC<ITileProps> = observer(
  function QuestionTileComponent(props) {
    return (
      <div className="question-tile">
        Question Tile
      </div>
    )
  }
)
```

#### question-tile.test.tsx

```typescript
describe("QuestionTileComponent", () => {
  it("renders without crashing", () => {
    const content = QuestionContent.create({
      type: "Question"
    })
    render(<QuestionTileComponent model={content} />)
    expect(screen.getByText("Question Tile")).toBeInTheDocument()
  })
})
```

#### question-tile.scss

```scss
.question-tile {
  padding: 8px;
  background: white;
  border: 1px solid #ccc;
}
```

## Integration Steps

### 1. Register Tile Content Info

```typescript
// In question-registration.ts
registerTileContentInfo({
  type: "Question",
  displayName: "Question",  // Used in menus and "Question It!" button
  modelClass: QuestionContent,
  metadataClass: TileMetadataModel,
  defaultContent: () => QuestionContent.create({ type: "Question" })
});
```

### 2. Register Tile Component Info

```typescript
// In question-registration.ts
registerTileComponentInfo({
  type: "Question",
  Component: QuestionTileComponent,
  tileEltClass: "question-tile",
  Icon: QuestionIcon,  // Need to create this
});
```

### 3. Add to Tile Registry

Add the Question tile to `register-tile-types.ts`:

```typescript
"Question": loggedLoad("Question", () => [
  import(/* webpackChunkName: "Question" */"./models/tiles/question/question-registration")
]),
```

### 4. Add to Curriculum Configuration

Update relevant curriculum JSON files to include Question in the toolbar configuration:

```json
{
  "id": "Question",
  "title": "Question",
  "isTileTool": true
}
```

## Testing Strategy

### Unit Tests

- Content model creation and defaults
- Basic property getters/setters
- Model serialization/deserialization

### Component Tests

- Basic rendering
- Props handling
- User interactions (when added)

### Integration Tests

- Tile creation from menu
- Tile persistence
- Tile loading

## Future Enhancements

- Add content structure
- Add editing capabilities
- Add question-specific features
- Add validation
- Add persistence logic

## Notes

- Following existing tile patterns from TextTile implementation
- Starting with minimal implementation
- Will iterate based on specific requirements