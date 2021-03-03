## Table Changes

### createTable
```typescript
interface ICreateTable {
  action: "create";
  target: "table";
  ids: string[];  // ids of columns to create; ids will be auto-generated if not provided
  props: {
    name?: string;  // name of table
    columns?: Array<{
      name?: string;  // name of column
    }>
  }
}
```

### createColumns
```typescript
interface ICreateColumns {
  action: "create";
  target: "columns";
  ids: string[];  // ids of columns to create; ids will be auto-generated if not provided
  props: {
    columns?: Array<{ name?: string; }>  // name of each column
  }
}
```

### createColumnsDeprecated
```typescript
// converted to canonical form automatically
interface ICreateColumnsDeprecated {
  action: "create";
  target: "columns";
  ids: string[];  // ids of columns to create; ids will be auto-generated if not provided
  props: Array<{ name?: string; }>  // name of each column
}
```

### createRowsDeprecated
```typescript
// converted to canonical form automatically
interface ICreateRowsDeprecated {
  action: "create";
  target: "rows";
  ids: string[];  // ids of rows to create; ids will be auto-generated if not provided
  props: Array<Record<string, any>>;  // each property is { [attributeID]: attributeValue }
}
```

### setTableName(name: string)
```typescript
interface ISetTableName {
  action: "update";
  target: "table";
  props: { name: string };
}
```

### setAttributeName(id: string, name: string)
```typescript
interface ISetAttributeName {
  action: "update";
  target: "columns";
  ids: string;  // expects single attribute ID despite name
  props: { name: string };
}
```

### removeAttributes(ids: string[])
```typescript
interface IRemoveAttributes {
  action: "delete";
  target: "columns";
  ids: string[];  // array of column/attribute IDs
}
```

### setExpression(id: string, expression: string, rawExpression: string)
```typescript
interface ISetExpression {
  action: "update";
  target: "columns";
  ids: string;  // expects single attribute ID despite name
  props: {
    expression: string,   // canonicalized in terms of __x__
    rawExpression: string // what the user actually typed
  }
}
```

### addCanonicalCases(cases: ICaseCreation[], beforeID?: string | string[], links?: ILinkProperties)
```typescript
interface IAddCanonicalCases {
  action: "create";
  target: "rows";
  ids: string[];  // array of row/case IDs
  props: {
    rows: Array<Record<string, any>>; // each property is { [attributeID]: attributeValue }
    beforeId?: string | string[]; // either the id of row to place all new rows before
                                  // or an array of row IDs to place each new row before
  },
  links?: { // ILinkProperties
    id: string;
    tileIds: string[];  // ids of geometry tiles to which these cases are connected
  }
}
```

### setCanonicalCaseValues(caseValues: ICase[], links?: ILinkProperties)
```typescript
interface ISetCanonicalCaseValues {
  action: "update";
  target: "rows";
  ids: string[];  // array of row/case IDs
  props: Array<Record<string, any>>;  // each property is { [attributeID]: attributeValue }
  links?: { // ILinkProperties
    id: string;
    tileIds: string[];  // ids of geometry tiles to which these cases are connected
  }
}
```

### removeCases(ids: string[], links?: ILinkProperties)
```typescript
interface IRemoveCases {
  action: "delete";
  target: "rows";
  ids: string[];  // ids of rows/cases to remove
  links?: { // ILinkProperties
    id: string;
    tileIds: string[];  // ids of geometry tiles to which these cases are connected
  }
}
```

### addGeometryLink(geometryId: string, links: ILinkProperties)
```typescript
interface IAddGeometryLink {
  action: "create";
  target: "geometryLink";
  ids: string;  // id of geometry tile to link
  links: { // ILinkProperties
    id: string;
    tileIds: string[];  // ids of connected geometry tiles
  }
}
```

### removeGeometryLink(geometryId: string, links?: ILinkProperties)
```typescript
  action: "delete";
  target: "geometryLink";
  ids: string; // id of affected geometry tiles
  links?: { // ILinkProperties
    id: string;
    tileIds: string[];  // ids of connected geometry tiles
  }
```
