// cf. https://github.com/lodash/lodash/issues/723#issuecomment-677383457
const omitDeep = (input: Record<string, unknown>, excludes: string[]): Record<string, unknown> => {
  return Object.entries(input).reduce((nextInput, [key, value]) => {
    const shouldExclude = excludes.includes(key);
    if (shouldExclude) return nextInput;

    if (Array.isArray(value)) {
      const arrValue = value;
      const nextValue = arrValue.map((arrItem) => {
        if (arrItem && typeof arrItem === "object") {
          return omitDeep(arrItem, excludes);
        }
        return arrItem;
      });
      nextInput[key] = nextValue;
      return nextInput;
    } else if (value && typeof value === "object") {
      nextInput[key] = omitDeep(value as Record<string, unknown>, excludes);
      return nextInput;
    }

    nextInput[key] = value;

    return nextInput;
  }, {} as Record<string, unknown>);
};

export default omitDeep;
