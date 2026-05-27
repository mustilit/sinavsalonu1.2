/**
 * ClamAV daemon entegrasyonu — file upload virus scan.
 *
 * Sprint 8 — file upload güvenliği'nin 2. katmanı.
 *   Katman 1 (Sprint 6): Magic byte detection + SVG reject
 *   Katman 2 (BU SPRINT): ClamAV virus scan
 *   Katman 3 (gelecek): S3 pre-signed URL + IAM bucket policy
 *
 * ClamAV daemon TCP socket protokolü:
 *   - Bağlan: TCP 3310 (default)
 *   - Komut: `zINSTREAM\0`
 *   - Veri: <4-byte big-endian size>...<chunk>... + 4-byte 0x00000000 terminator
 *   - Yanıt: `stream: OK` (temiz) veya `stream: VIRUS_NAME FOUND` (kötü amaçlı)
 *
 * DEPLOYMENT:
 *   - Docker compose: clamav/clamav:stable image, port 3310
 *   - Helm: clamav-deployment.yaml + servis (port 3310)
 *   - env: CLAMAV_HOST, CLAMAV_PORT (default localhost:3310)
 *
 * FAILURE MODE:
 *   - Daemon ulaşılamazsa: env CLAMAV_FAIL_OPEN=true ise dosya kabul edilir,
 *     audit log'a uyarı düşülür. Default fail-closed (dosya reddedilir).
 *   - Üretim için fail-closed önerilir.
 *
 * PERFORMANS:
 *   - Tipik scan: 50-200ms (5MB dosya)
 *   - Async — upload endpoint yine de hızlı kalır
 *   - Connection pool yok (her scan yeni socket); ihtiyaç olursa eklenir.
 */

import { Socket } from 'net';

export interface ClamAvConfig {
  host: string;
  port: number;
  timeoutMs: number;
  failOpen: boolean;
}

export interface ScanResult {
  clean: boolean;
  /** Eğer virüs bulunduysa adı (örn. "Eicar-Test-Signature") */
  threat?: string;
  /** Hata varsa açıklama */
  error?: string;
  /** ms cinsinden scan süresi */
  durationMs: number;
}

const DEFAULT_CONFIG: ClamAvConfig = {
  host: process.env.CLAMAV_HOST || 'localhost',
  port: parseInt(process.env.CLAMAV_PORT || '3310', 10),
  timeoutMs: parseInt(process.env.CLAMAV_TIMEOUT_MS || '10000', 10),
  failOpen: process.env.CLAMAV_FAIL_OPEN === 'true',
};

/**
 * Buffer'ı ClamAV daemon'a stream eder ve sonucu döner.
 * Daemon erişilemezse failOpen kuralına göre davranır.
 */
export function scanBuffer(buffer: Buffer, config: ClamAvConfig = DEFAULT_CONFIG): Promise<ScanResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new Socket();
    let response = '';
    let resolved = false;

    const finish = (result: Partial<ScanResult>) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        clean: result.clean ?? false,
        threat: result.threat,
        error: result.error,
        durationMs: Date.now() - start,
      });
    };

    socket.setTimeout(config.timeoutMs);

    socket.on('timeout', () => {
      finish({
        clean: config.failOpen,
        error: `ClamAV timeout (${config.timeoutMs}ms) — ${config.failOpen ? 'fail-open' : 'fail-closed'}`,
      });
    });

    socket.on('error', (err) => {
      finish({
        clean: config.failOpen,
        error: `ClamAV bağlantı hatası: ${err.message} — ${config.failOpen ? 'fail-open' : 'fail-closed'}`,
      });
    });

    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
    });

    socket.on('end', () => {
      // Yanıt formatları:
      //   "stream: OK\n"                              — temiz
      //   "stream: Eicar-Test-Signature FOUND\n"      — virüs
      //   "stream: <error> ERROR\n"                   — daemon hatası
      const match = response.match(/stream:\s*(.+)$/m);
      if (!match) {
        return finish({
          clean: config.failOpen,
          error: `ClamAV anlaşılamayan yanıt: ${response.slice(0, 100)}`,
        });
      }
      const result = match[1].trim();
      if (result === 'OK') {
        finish({ clean: true });
      } else if (result.endsWith(' FOUND')) {
        const threat = result.replace(/ FOUND$/, '');
        finish({ clean: false, threat });
      } else if (result.endsWith(' ERROR')) {
        finish({
          clean: config.failOpen,
          error: `ClamAV scan hatası: ${result}`,
        });
      } else {
        finish({
          clean: false,
          error: `Beklenmeyen ClamAV yanıtı: ${result}`,
        });
      }
    });

    socket.connect(config.port, config.host, () => {
      // ─── zINSTREAM protokolü ──────────────────────────────────────────
      // 1. "zINSTREAM\0" komutu (z prefix = NULL-terminated yanıt)
      socket.write('zINSTREAM\0');

      // 2. Veri chunk'ları (big-endian 4-byte size prefix)
      const sizeBuf = Buffer.alloc(4);
      sizeBuf.writeUInt32BE(buffer.length, 0);
      socket.write(sizeBuf);
      socket.write(buffer);

      // 3. Terminator (4-byte zero)
      const terminator = Buffer.alloc(4);
      terminator.writeUInt32BE(0, 0);
      socket.write(terminator);
    });
  });
}

/**
 * Yüksek seviyeli yardımcı: scan + boolean result.
 *
 * @throws asla — başarısızlık durumunda failOpen kuralına göre.
 */
export async function isClean(buffer: Buffer, config?: ClamAvConfig): Promise<{ clean: boolean; threat?: string }> {
  const result = await scanBuffer(buffer, config);
  return { clean: result.clean, threat: result.threat };
}
