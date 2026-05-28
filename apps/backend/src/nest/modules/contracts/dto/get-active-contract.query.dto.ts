import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * ContractType — Sprint 14'te genişletildi.
 *  - CANDIDATE      : Üyelik / Kullanım Sözleşmesi (kayıt, her kullanıcı)
 *  - EDUCATOR       : Eğitici Hizmet Sözleşmesi (eğitici kaydı / paket yayımlama)
 *  - PRIVACY        : KVKK Aydınlatma Metni (kayıt, her kullanıcı)
 *  - DISTANCE_SALE  : Mesafeli Satış Sözleşmesi + Ön Bilgilendirme (her satın almada)
 */
export type ContractType = 'CANDIDATE' | 'EDUCATOR' | 'PRIVACY' | 'DISTANCE_SALE';

const CONTRACT_TYPES: ContractType[] = ['CANDIDATE', 'EDUCATOR', 'PRIVACY', 'DISTANCE_SALE'];

export class GetActiveContractQueryDto {
  @ApiProperty({ enum: CONTRACT_TYPES })
  @IsIn(CONTRACT_TYPES, { message: 'type must be CANDIDATE, EDUCATOR, PRIVACY or DISTANCE_SALE' })
  type!: ContractType;
}
