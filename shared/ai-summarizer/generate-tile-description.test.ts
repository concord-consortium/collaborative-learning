import { generateTileDescription } from './generate-tile-description';

describe('generateTileDescription', () => {
  describe('basic functionality', () => {
    it('should handle empty object', () => {
      // The function doesn't handle undefined type gracefully, so we expect an error
      expect(() => generateTileDescription({}))
      .toThrow();
    });

    it('should handle object with only ignored keys', () => {
      const result = generateTileDescription({ id: '123', type: 'Test' });
      expect(result).toBe('In the test content there are no properties to describe.');
    });

    it('should handle object with type but no other properties', () => {
      const result = generateTileDescription({ type: 'Test' });
      expect(result).toBe('In the test content there are no properties to describe.');
    });
  });

  describe('boolean values', () => {
    it('should handle boolean true', () => {
      const result = generateTileDescription({ type: 'Test', isVisible: true });
      expect(result).toBe('In the test content properties, isVisible is true.');
    });

    it('should handle boolean false', () => {
      const result = generateTileDescription({ type: 'Test', isVisible: false });
      expect(result).toBe('In the test content properties, isVisible is false.');
    });
  });

  describe('number values', () => {
    it('should handle valid numbers', () => {
      const result = generateTileDescription({ type: 'Test', count: 42 });
      expect(result).toBe('In the test content properties, count is 42.');
    });

    it('should handle zero', () => {
      const result = generateTileDescription({ type: 'Test', count: 0 });
      expect(result).toBe('In the test content properties, count is 0.');
    });

    it('should handle negative numbers', () => {
      const result = generateTileDescription({ type: 'Test', count: -5 });
      expect(result).toBe('In the test content properties, count is -5.');
    });

    it('should handle NaN', () => {
      const result = generateTileDescription({ type: 'Test', count: NaN });
      expect(result).toBe('In the test content properties, count is not a valid number.');
    });
  });

  describe('string values', () => {
    it('should handle normal strings', () => {
      const result = generateTileDescription({ type: 'Test', name: 'hello' });
      expect(result).toBe('In the test content properties, name is "hello".');
    });

    it('should handle empty strings', () => {
      const result = generateTileDescription({ type: 'Test', name: '' });
      expect(result).toBe('In the test content properties, name is an empty string.');
    });

    it('should handle quoted strings', () => {
      const result = generateTileDescription({ type: 'Test', name: '"quoted"' });
      expect(result).toBe('In the test content properties, name is "quoted".');
    });

    it('should handle strings with special characters', () => {
      const result = generateTileDescription({ type: 'Test', name: 'Hello world ♥' });
      expect(result).toBe('In the test content properties, name is "Hello world ♥".');
    });
  });

  describe('null and undefined values', () => {
    it('should handle null values', () => {
      const result = generateTileDescription({ type: 'Test', value: null });
      expect(result).toBe('In the test content properties, value is not set.');
    });

    it('should handle undefined values', () => {
      const result = generateTileDescription({ type: 'Test', value: undefined });
      expect(result).toBe('In the test content properties, value is not set.');
    });
  });

  describe('array values', () => {
    it('should handle empty arrays', () => {
      const result = generateTileDescription({ type: 'Test', items: [] });
      expect(result).toBe('In the test content properties, items is an empty array.');
    });

    it('should handle arrays with single item', () => {
      const result = generateTileDescription({ type: 'Test', items: [{ id: 1, name: 'test' }] });
      // id is filtered out by univeralKeysToIgnore, so only name remains
      // eslint-disable-next-line max-len
      expect(result).toBe('In the test content properties, items is an array of 1 item with 1 common attribute (name).');
    });

    it('should handle arrays with multiple items', () => {
      const result = generateTileDescription({
        type: 'Test',
        items: [
          { id: 1, name: 'test1' },
          { id: 2, name: 'test2' }
        ]
      });
      // id is filtered out by univeralKeysToIgnore, so only name remains
      // eslint-disable-next-line max-len
      expect(result).toBe('In the test content properties, items is an array of 2 items with 1 common attribute (name).');
    });

    it('should handle arrays with no common attributes', () => {
      const result = generateTileDescription({
        type: 'Test',
        items: [
          { id: 1 },
          { name: 'test2' }
        ]
      });
      expect(result).toBe('In the test content properties, items is an array of 2 items with 0 common attributes.');
    });
  });

  describe('object values', () => {
    it('should handle empty objects', () => {
      const result = generateTileDescription({ type: 'Test', config: {} });
      expect(result).toBe('In the test content properties, config is an empty array.');
    });

    it('should handle objects with values', () => {
      const result = generateTileDescription({ type: 'Test', config: { key1: 'value1', key2: 'value2' } });
      // Object.values() returns ['value1', 'value2'], which are primitive strings
      // The getCommonAttributes function treats these as objects with numeric keys (0, 1, 2, etc.)
      // eslint-disable-next-line max-len
      expect(result).toBe('In the test content properties, config is an array of 2 items with 6 common attributes (0, 1, 2, 3, 4, and 5).');
    });
  });

  describe('component type specific behavior', () => {
    describe('Drawing tile type', () => {
      it('should ignore stamps property', () => {
        const result = generateTileDescription({
          type: 'Drawing',
          stamps: ['stamp1', 'stamp2'],
          isVisible: true
        });
        expect(result).toBe('In the drawing content properties, isVisible is true.');
      });

      it('should provide extra description for objects', () => {
        const result = generateTileDescription({
          type: 'Drawing',
          objects: [
            { type: 'rectangle', x: 10, y: 20 },
            { type: 'circle', x: 30, y: 40 }
          ]
        });
        expect(result).toContain('The objects in the drawing tile content are: rectangle, and circle.');
      });

      it('should handle empty objects array', () => {
        const result = generateTileDescription({
          type: 'Drawing',
          objects: []
        });
        expect(result).toBe('In the drawing content properties, objects is an empty array.');
      });
    });

    describe('Table tile type', () => {
      it('should ignore importedDataSet, isImported, and columnWidths properties', () => {
        const result = generateTileDescription({
          type: 'Table',
          importedDataSet: 'data.csv',
          isImported: true,
          columnWidths: [100, 200],
          name: 'My Table'
        });
        expect(result).toBe('In the table content properties, name is "My Table".');
      });
    });

    describe('Numberline tile type', () => {
      it('should provide extra description for points', () => {
        const result = generateTileDescription({
          type: 'Numberline',
          points: {
            point1: { xValue: 0, yValue: 10 },
            point2: { xValue: 5, yValue: 20 }
          }
        });
        expect(result).toContain('The xValues for the points property in the number line tile content are: 0, and 5.');
      });

      it('should handle empty points object', () => {
        const result = generateTileDescription({
          type: 'Numberline',
          points: {}
        });
        expect(result).toBe('In the numberline content properties, points is an empty array.');
      });

      it('should handle points with no xValue', () => {
        const result = generateTileDescription({
          type: 'Numberline',
          points: {
            point1: { yValue: 10 }
          }
        });
        // The extra description will show empty xValues since no xValue exists
        // eslint-disable-next-line max-len
        expect(result).toBe('In the numberline content properties, points is an array of 1 item with 1 common attribute (yValue).\n\nThe xValues for the points property in the number line tile content are: .');
      });
    });

    describe('Expression tile type', () => {
      it('should provide extra description for latexStr', () => {
        const result = generateTileDescription({
          type: 'Expression',
          latexStr: 'x^2 + y^2 = r^2'
        });
        expect(result).toContain('The latexStr property contains the LaTeX representation of the expression.');
      });

      it('should handle expression without latexStr', () => {
        const result = generateTileDescription({
          type: 'Expression',
          name: 'My Expression'
        });
        expect(result).toBe('In the expression content properties, name is "My Expression".');
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed property types', () => {
      const result = generateTileDescription({
        type: 'Test',
        name: 'Test Tile',
        isVisible: true,
        count: 42,
        items: [{ id: 1 }, { id: 2 }],
        config: { key: 'value' }
      });
      expect(result).toContain('name is "Test Tile"');
      expect(result).toContain('isVisible is true');
      expect(result).toContain('count is 42');
      // id is filtered out, so no common attributes
      expect(result).toContain('items is an array of 2 items with 0 common attributes');
      // Object.values() on { key: 'value' } returns ['value'], which has numeric keys
      expect(result).toContain('config is an array of 1 item with 5 common attributes (0, 1, 2, 3, and 4)');
    });

    it('should handle deeply nested objects', () => {
      const result = generateTileDescription({
        type: 'Test',
        nested: {
          level1: {
            level2: {
              value: 'deep'
            }
          }
        }
      });
      // Object.values() returns the nested object, which has level1 as a key
      // The getCommonAttributes function finds level2 as a common attribute
      expect(result).toContain('nested is an array of 1 item with 1 common attribute (level2)');
    });

    it('should handle arrays with mixed types', () => {
      const result = generateTileDescription({
        type: 'Test',
        mixed: [
          { type: 'string', value: 'hello' },
          { type: 'number', value: 42 },
          { type: 'boolean', value: true }
        ]
      });
      // oxFordAnd adds "and" before the last item
      expect(result).toContain('mixed is an array of 3 items with 2 common attributes (type, and value)');
    });
  });

  describe('edge cases', () => {
    it('should handle object with circular references gracefully', () => {
      const circular: any = { type: 'Test', name: 'circular' };
      circular.self = circular;

      // This should not throw an error
      expect(() => generateTileDescription(circular)).not.toThrow();
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const result = generateTileDescription({ type: 'Test', description: longString });
      expect(result).toContain(`description is "${longString}"`);
    });

    it('should handle special characters in strings', () => {
      const result = generateTileDescription({
        type: 'Test',
        name: 'Special: "quotes", \'apostrophes\', & symbols!'
      });
      // The function doesn't escape quotes, it just strips them if they're at the start/end
      expect(result).toContain('name is "Special: "quotes", \'apostrophes\', & symbols!"');
    });

  });

  describe('sorting behavior', () => {
    it('should sort properties alphabetically', () => {
      const result = generateTileDescription({
        type: 'Test',
        zebra: 'stripes',
        alpha: 'first',
        beta: 'second'
      });

      // Properties should be in alphabetical order: alpha, beta, zebra
      const propertyIndex = result.indexOf('properties, ');
      const propertiesSection = result.substring(propertyIndex);

      expect(propertiesSection).toContain('alpha is "first"');
      expect(propertiesSection).toContain('beta is "second"');
      expect(propertiesSection).toContain('zebra is "stripes"');

      // Verify the order
      const alphaIndex = propertiesSection.indexOf('alpha');
      const betaIndex = propertiesSection.indexOf('beta');
      const zebraIndex = propertiesSection.indexOf('zebra');

      expect(alphaIndex).toBeLessThan(betaIndex);
      expect(betaIndex).toBeLessThan(zebraIndex);
    });
  });
});
