import "../nodes/num-socket";

function doSomething<T extends Record<K, number>, K extends keyof T>(key: K, model: T) {
  return model[key];
}

function add1(val: number){
  return val+1;
}

function doSomething2<
  T extends
    Record<K, number> &
    Record<`${K}Units`, string>,
  K extends keyof T & string
>(key: K, model: T) {
  const val = model[key];
  const val2 = add1(val);
  const units = model[`${key}Units`];
  return {val, units};
}

const test1 = {
  setValue(val: number) {
    console.log(val);
  }
};

// eslint-disable-next-line dot-notation
test1["setValue"](1);
