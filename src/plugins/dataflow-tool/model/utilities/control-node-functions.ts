export function zeroSentence(n1: string) {
  if (n1 === "0"){
    return `0 ≡ gate off ⇒`;
  }

  if (n1 === "1"){
    return `1 ≡ gate on ⇒`;
  }
}