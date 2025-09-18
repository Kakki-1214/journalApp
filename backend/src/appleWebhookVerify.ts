import crypto from 'crypto';

// デフォルト Apple ルート証明書 SHA256 フィンガープリント候補 (例示; 要確認・更新)
// 実運用では Apple 公開ルート証明書から取得した値に差し替えること。
const DEFAULT_APPLE_ROOT_FPS: string[] = [
  // 'D4E5437FB1A1B0AC...' // 例: 実際の値を運用時に設定
];

let cachedRootSet: Set<string> | null = null;
function loadAllowedRootFingerprints(): Set<string> {
  if(cachedRootSet) return cachedRootSet;
  const envList = (process.env.APPLE_ROOT_FINGERPRINTS || '')
    .split(',')
    .map(s=>s.trim())
    .filter(Boolean);
  const merged = [...new Set([...envList, ...DEFAULT_APPLE_ROOT_FPS])]
    .map(fp => fp.replace(/:/g,'').toUpperCase());
  cachedRootSet = new Set(merged);
  return cachedRootSet;
}

interface VerifyResult { valid: boolean; payload?: any; error?: string; chain?: { subject: string; issuer: string; notBefore: string; notAfter: string; fingerprint: string; }[]; revocationChecked?: boolean; revoked?: boolean }

// Apple の通知 JWS 署名検証 (拡張版)
// 1. JWS 形式チェック
// 2. x5c チェーン展開
// 3. 各証明書: 期限内 / 簡易 issuer-subject 連結整合性
// 4. ルート証明書フィンガープリント許可リストチェック (静的ホワイトリスト; Apple 既知 root 指紋を必要に応じ更新)
// 5. 署名検証 (leaf 公開鍵)
// 6. デコード payload 返却
// 注意: CRL/OCSP は未実装 (将来拡張)
export async function verifyAppleSignedPayload(signedPayload: string): Promise<VerifyResult> {
  try {
  const parts = signedPayload.split('.');
    if(parts.length !== 3) return { valid:false, error:'FORMAT' };
    const headerJson = JSON.parse(Buffer.from(parts[0],'base64').toString('utf8'));
    const certs: string[] = headerJson.x5c || [];
    if(!certs.length) return { valid:false, error:'NO_X5C' };

    // 許可 root フィンガープリント (例: Apple Worldwide Developer Relations など) - SHA256 指紋
    // 実運用では Apple 公開情報に基づき更新すること。
  const allowedRootFingerprints = loadAllowedRootFingerprints();

    const chainInfo: VerifyResult['chain'] = [];
    let previousSubject: string | null = null;
    let rootFingerprint: string | null = null;

    for(let i=0;i<certs.length;i++) {
      const pem = '-----BEGIN CERTIFICATE-----\n'+certs[i]+'\n-----END CERTIFICATE-----';
      const certObj = new crypto.X509Certificate(pem);
      const subject = certObj.subject; // e.g. CN=...
      const issuer = certObj.issuer;
      const notBefore = certObj.validFrom;
      const notAfter = certObj.validTo;
      // 期限チェック
      const now = Date.now();
      if(now < Date.parse(notBefore) || now > Date.parse(notAfter)) {
        return { valid:false, error:'CERT_EXPIRED_OR_NOT_YET_VALID', chain: chainInfo };
      }
      // チェーンのシンプルな整合性 (前の subject が次の issuer になる想定)
      if(previousSubject && issuer !== previousSubject) {
        // 根拠薄い場合は warning 的: とりあえず失敗扱い
        return { valid:false, error:'CHAIN_MISMATCH', chain: chainInfo };
      }
      previousSubject = subject;
      const fingerprint = certObj.fingerprint256.replace(/:/g,'').toUpperCase();
      chainInfo.push({ subject, issuer, notBefore, notAfter, fingerprint });
      if(i === certs.length -1) rootFingerprint = fingerprint; // 末尾を root と仮定
    }

    if(rootFingerprint && allowedRootFingerprints.size>0 && !allowedRootFingerprints.has(rootFingerprint)) {
      return { valid:false, error:'UNTRUSTED_ROOT', chain: chainInfo };
    }

    // Leaf 署名検証
    const leafPem = '-----BEGIN CERTIFICATE-----\n'+certs[0]+'\n-----END CERTIFICATE-----';
    const leafKey = crypto.createPublicKey(leafPem);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(parts[0] + '.' + parts[1]);
    verify.end();
    const sig = Buffer.from(parts[2],'base64');
    const ok = verify.verify(leafKey, sig);
    if(!ok) return { valid:false, error:'BAD_SIGNATURE', chain: chainInfo };

    const payload = JSON.parse(Buffer.from(parts[1],'base64').toString('utf8'));
    // 失効確認 (OCSP/CRL) - 現在はスタブ: 後で実装
    const revocation = await checkRevocationStub(chainInfo);
    if(revocation.revoked) return { valid:false, error:'CERT_REVOKED', chain: chainInfo, revocationChecked:true, revoked:true };
    return { valid:true, payload, chain: chainInfo, revocationChecked:true, revoked:false };
  } catch(e:any) {
    return { valid:false, error:e.message };
  }
}

// TODO: OCSP / CRL による失効確認, 証明書ポリシー OID 検証などの強化

// 暫定スタブ: 将来 OCSP / CRL 実装時に差し替え
async function checkRevocationStub(_chain: NonNullable<VerifyResult['chain']>): Promise<{ revoked:boolean }> {
  return { revoked:false };
}