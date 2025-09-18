declare module 'jwk-to-pem' {
  interface JwkToPemOptions { private?: boolean; skipValidation?: boolean; }
  function jwkToPem(jwk: any, options?: JwkToPemOptions): string;
  export = jwkToPem;
}
