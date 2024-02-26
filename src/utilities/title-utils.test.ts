import { defaultTitle, extractTitleBase, titleMatchesDefault } from "./title-utils";

describe('defaultTitle', () => {
  it('correctly appends a numeric suffix to a title base', () => {
    const titleBase = 'Title';
    const titleNumber = 1;
    const expected = 'Title 1';
    expect(defaultTitle(titleBase, titleNumber)).toBe(expected);
  });

  it('handles an empty title base', () => {
    const titleBase = '';
    const titleNumber = 2;
    const expected = ' 2';
    expect(defaultTitle(titleBase, titleNumber)).toBe(expected);
  });

  it('works with a zero numeric suffix', () => {
    const titleBase = 'Title';
    const titleNumber = 0;
    const expected = 'Title 0';
    expect(defaultTitle(titleBase, titleNumber)).toBe(expected);
  });
});

describe('extractTitleBase', () => {
  it('returns the title unchanged if there is no numeric suffix', () => {
    const title = 'Title without number';
    expect(extractTitleBase(title)).toBe(title);
  });

  it('removes the numeric suffix from the title', () => {
    const title = 'Title 123';
    expect(extractTitleBase(title)).toBe('Title');
  });

  it('removes the numeric suffix even if there are no spaces before it', () => {
    const title = 'Election2020';
    expect(extractTitleBase(title)).toBe('Election');
  });

  it('returns an empty string for purely numeric titles', () => {
    const title = '123';
    expect(extractTitleBase(title)).toBe('');
  });

  it('returns an empty string if the input is an empty string', () => {
    const title = '';
    expect(extractTitleBase(title)).toBe('');
  });
});

describe('titleMatchesDefault', () => {
  it('identifies a title matching the standard format with a base and a numeric suffix', () => {
    let title = 'ExampleTitle 123';
    const titleBase = 'ExampleTitle';
    let match = titleMatchesDefault(title, titleBase);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('123');

    title = 'ExampleTitle123';
    match = titleMatchesDefault(title, titleBase);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('123');

    title = 'ExampleTitle       123';
    match = titleMatchesDefault(title, titleBase);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('123');
  });

  it('returns null for a title that does not follow the standard format', () => {
    const title = 'NonStandardTitle-123';
    const titleBase = 'NonStandardTitle';
    const match = titleMatchesDefault(title, titleBase);
    expect(match).toBeNull();
  });

  it('returns null for a title missing the numeric suffix', () => {
    const title = 'ExampleTitle';
    const titleBase = 'ExampleTitle';
    const match = titleMatchesDefault(title, titleBase);
    expect(match).toBeNull();
  });

  it('correctly captures the numeric suffix when there are leading zeros', () => {
    const title = 'ExampleTitle 007';
    const titleBase = 'ExampleTitle';
    const match = titleMatchesDefault(title, titleBase);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('007');
  });

  it('returns null if either the title or the titleBase is undefined', () => {
    const titleBase = 'ExampleTitle';
    let match = titleMatchesDefault(undefined, titleBase);
    expect(match).toBeNull();

    const title = 'ExampleTitle 123';
    match = titleMatchesDefault(title, undefined);
    expect(match).toBeNull();
  });

  it('handles cases where the titleBase occurs more than once', () => {
    const title = 'TitleBase 2TitleBase 3';
    const titleBase = 'TitleBase';
    const match = titleMatchesDefault(title, titleBase);
    expect(match).toBeNull();
  });
});
