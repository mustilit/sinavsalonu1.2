/**
 * dbRouter unit testleri.
 *
 * Read/Write client seçimi + lag detection mock'lu.
 */

jest.mock('../../src/infrastructure/database/prisma', () => ({
  prisma: { name: 'primary' } as any,
  prismaReplica: { name: 'replica', $queryRaw: jest.fn() } as any,
  isReplicaEnabled: jest.fn(),
}));

import * as prismaModule from '../../src/infrastructure/database/prisma';
import {
  prismaWrite,
  prismaRead,
  measureReplicaLag,
  refreshLagCache,
  getReplicaStatus,
} from '../../src/infrastructure/database/dbRouter';

const isReplicaEnabledMock = prismaModule.isReplicaEnabled as jest.Mock;
const replicaQueryRawMock = (prismaModule.prismaReplica as any).$queryRaw as jest.Mock;

describe('dbRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('prismaWrite', () => {
    it('her zaman primary client döner', () => {
      expect((prismaWrite as any).name).toBe('primary');
    });
  });

  describe('prismaRead', () => {
    it('replica aktif değilse primary döner', () => {
      isReplicaEnabledMock.mockReturnValue(false);
      const client = prismaRead();
      expect((client as any).name).toBe('primary');
    });

    it('requireFresh=true ise replica aktif olsa bile primary döner', () => {
      isReplicaEnabledMock.mockReturnValue(true);
      const client = prismaRead({ requireFresh: true });
      expect((client as any).name).toBe('primary');
    });

    it('replica aktif + cache yok ise fail-open ile primary döner', () => {
      isReplicaEnabledMock.mockReturnValue(true);
      const client = prismaRead();
      // İlk çağrıda cache henüz yok — LAG_FAIL_OPEN=true gereği primary
      expect((client as any).name).toBe('primary');
    });
  });

  describe('measureReplicaLag', () => {
    it('replica aktif değilse 0 döner', async () => {
      isReplicaEnabledMock.mockReturnValue(false);
      const lag = await measureReplicaLag();
      expect(lag).toBe(0);
    });

    it('replica aktif + sorgu başarılı → lag saniye olarak döner', async () => {
      isReplicaEnabledMock.mockReturnValue(true);
      replicaQueryRawMock.mockResolvedValue([{ lag_seconds: 1.23 }]);
      const lag = await measureReplicaLag();
      expect(lag).toBe(1.23);
    });

    it('sorgu hatası → null döner (fail-open)', async () => {
      isReplicaEnabledMock.mockReturnValue(true);
      replicaQueryRawMock.mockRejectedValue(new Error('connection refused'));
      const lag = await measureReplicaLag();
      expect(lag).toBeNull();
    });

    it('pg_is_in_recovery=false (primary mode) → 0 döner', async () => {
      isReplicaEnabledMock.mockReturnValue(true);
      replicaQueryRawMock.mockResolvedValue([{ lag_seconds: 0 }]);
      const lag = await measureReplicaLag();
      expect(lag).toBe(0);
    });
  });

  describe('refreshLagCache', () => {
    it('lag ölçüp cache\'i günceller', async () => {
      isReplicaEnabledMock.mockReturnValue(true);
      replicaQueryRawMock.mockResolvedValue([{ lag_seconds: 0.5 }]);
      const lag = await refreshLagCache();
      expect(lag).toBe(0.5);
    });
  });

  describe('getReplicaStatus', () => {
    it('replica aktif değilse healthy döner', async () => {
      isReplicaEnabledMock.mockReturnValue(false);
      const status = await getReplicaStatus();
      expect(status).toEqual({
        enabled: false,
        lagSeconds: 0,
        healthy: true,
        degradedMode: false,
      });
    });

    it('replica sağlıklı + düşük lag → healthy & not degraded', async () => {
      isReplicaEnabledMock.mockReturnValue(true);
      replicaQueryRawMock.mockResolvedValue([{ lag_seconds: 0.5 }]);
      const status = await getReplicaStatus();
      expect(status.enabled).toBe(true);
      expect(status.lagSeconds).toBe(0.5);
      expect(status.healthy).toBe(true);
      expect(status.degradedMode).toBe(false);
    });

    it('lag > 5s → degraded mode', async () => {
      isReplicaEnabledMock.mockReturnValue(true);
      replicaQueryRawMock.mockResolvedValue([{ lag_seconds: 10 }]);
      const status = await getReplicaStatus();
      expect(status.degradedMode).toBe(true);
    });

    it('lag sorgusu başarısız → unhealthy + degraded', async () => {
      isReplicaEnabledMock.mockReturnValue(true);
      replicaQueryRawMock.mockRejectedValue(new Error('conn refused'));
      const status = await getReplicaStatus();
      expect(status.healthy).toBe(false);
      expect(status.degradedMode).toBe(true);
    });
  });
});
