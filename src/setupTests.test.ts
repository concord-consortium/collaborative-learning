describe("setupTests", () => {
  describe("assertIsDefined", () => {
    it("handles undefined values", () => {
      const value = undefined;

      expect(() => {
        assertIsDefined(value);
      }).toThrow();
    });

    it("handles null values", () => {
      const value = null;

      expect(() => {
        assertIsDefined(value);
      }).toThrow();
    });

    it("handled not undefined values", () => {      
      const value: number | undefined = 1 as any;

      // Without this, the next line would have a type error because value could 
      // be undefined
      assertIsDefined(value);

      expect(value + 1).toBe(2);
    });

    it("handled not null values", () => {      
      const value: number | null = 1 as any;

      // Without this, the next line would have a type error because value could 
      // be null
      assertIsDefined(value);

      expect(value + 1).toBe(2);
    });

  });
});
