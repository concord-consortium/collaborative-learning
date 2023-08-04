
export function linearMap(a:number, b:number, c:number, d:number, t:number){ // a and b input range, t is input
  const scale = (d-c)/(b-a);
  const offset = -a*(d-c)/(b-a)+c;
  return (t*scale)+offset;
}

