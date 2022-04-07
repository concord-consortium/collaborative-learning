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
      // `as any` is used here to verify that assertIsDefined is working 
      // with Typescript correctly. Without `as any` typescript ignores 
      // the `number | undefined` and just uses `number`. So then `value + 1`
      // is fine even without the `assertIsDefined`.
      const value: number | undefined = 1 as any;

      // Without this, the next line should have a type error because value could 
      // be undefined
      assertIsDefined(value);

      expect(value + 1).toBe(2);
    });

    it("handled not null values", () => {      
      // `as any` is used here to verify that assertIsDefined is working 
      // with Typescript correctly. Without `as any` typescript ignores 
      // the `number | undefined` and just uses `number`. So then `value + 1`
      // is fine even without the `assertIsDefined`.      
      const value: number | null = 1 as any;

      // Without this, the next line should have a type error because value could 
      // be null
      assertIsDefined(value);

      expect(value + 1).toBe(2);
    });

  });
});
