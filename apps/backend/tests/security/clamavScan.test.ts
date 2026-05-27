/**
 * ClamAV scan testleri — daemon mock'lu (net.Socket spy).
 *
 * Gerçek ClamAV daemon entegrasyon testi `tests/integration/` altında
 * (Sprint 8'in scope dışı; daemon container gerekli).
 */

import { scanBuffer, isClean } from '../../src/application/security/clamavScan';
import * as net from 'net';

jest.mock('net');

describe('clamavScan — daemon mock', () => {
  let mockSocket: any;
  let socketHandlers: Record<string, Function> = {};

  beforeEach(() => {
    socketHandlers = {};
    mockSocket = {
      setTimeout: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        socketHandlers[event] = handler;
      }),
      connect: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
    };
    (net.Socket as any).mockImplementation(() => mockSocket);
  });

  it('temiz dosyada clean=true döner', async () => {
    const promise = scanBuffer(Buffer.from([0xff, 0xd8, 0xff]), {
      host: 'localhost',
      port: 3310,
      timeoutMs: 1000,
      failOpen: false,
    });

    // Connect callback'i tetikle
    const connectCb = mockSocket.connect.mock.calls[0][2];
    connectCb();

    // Daemon "stream: OK" yanıtı
    socketHandlers.data?.(Buffer.from('stream: OK\n'));
    socketHandlers.end?.();

    const result = await promise;
    expect(result.clean).toBe(true);
    expect(result.threat).toBeUndefined();
  });

  it('virüs bulunduğunda clean=false + threat name döner', async () => {
    const promise = scanBuffer(Buffer.from([0xff, 0xd8, 0xff]), {
      host: 'localhost',
      port: 3310,
      timeoutMs: 1000,
      failOpen: false,
    });

    const connectCb = mockSocket.connect.mock.calls[0][2];
    connectCb();
    socketHandlers.data?.(Buffer.from('stream: Eicar-Test-Signature FOUND\n'));
    socketHandlers.end?.();

    const result = await promise;
    expect(result.clean).toBe(false);
    expect(result.threat).toBe('Eicar-Test-Signature');
  });

  it('daemon erişilemezse fail-closed (clean=false)', async () => {
    const promise = scanBuffer(Buffer.from([0xff, 0xd8, 0xff]), {
      host: 'localhost',
      port: 3310,
      timeoutMs: 1000,
      failOpen: false,
    });

    socketHandlers.error?.(new Error('ECONNREFUSED'));

    const result = await promise;
    expect(result.clean).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('failOpen=true ile daemon hatası clean=true döner', async () => {
    const promise = scanBuffer(Buffer.from([0xff, 0xd8, 0xff]), {
      host: 'localhost',
      port: 3310,
      timeoutMs: 1000,
      failOpen: true,
    });

    socketHandlers.error?.(new Error('ECONNREFUSED'));

    const result = await promise;
    expect(result.clean).toBe(true);
    expect(result.error).toContain('fail-open');
  });

  it('isClean yüksek seviye yardımcı doğru çalışır', async () => {
    const promise = isClean(Buffer.from([0xff, 0xd8, 0xff]), {
      host: 'localhost',
      port: 3310,
      timeoutMs: 1000,
      failOpen: false,
    });

    const connectCb = mockSocket.connect.mock.calls[0][2];
    connectCb();
    socketHandlers.data?.(Buffer.from('stream: OK\n'));
    socketHandlers.end?.();

    const result = await promise;
    expect(result.clean).toBe(true);
  });

  it('zINSTREAM komutu + büyük endian size + terminator gönderir', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const promise = scanBuffer(buffer, {
      host: 'localhost',
      port: 3310,
      timeoutMs: 1000,
      failOpen: false,
    });

    const connectCb = mockSocket.connect.mock.calls[0][2];
    connectCb();
    socketHandlers.data?.(Buffer.from('stream: OK\n'));
    socketHandlers.end?.();
    await promise;

    // Komut sırası:
    //   write("zINSTREAM\0")
    //   write(<4-byte size>)
    //   write(<buffer>)
    //   write(<4-byte 0>)
    expect(mockSocket.write).toHaveBeenCalledTimes(4);
    expect(mockSocket.write.mock.calls[0][0]).toBe('zINSTREAM\0');

    const sizeBuf = mockSocket.write.mock.calls[1][0];
    expect(sizeBuf.readUInt32BE(0)).toBe(buffer.length);

    expect(mockSocket.write.mock.calls[2][0]).toEqual(buffer);

    const terminator = mockSocket.write.mock.calls[3][0];
    expect(terminator.readUInt32BE(0)).toBe(0);
  });
});
