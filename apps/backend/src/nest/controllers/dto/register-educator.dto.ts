/** Eğitici kaydı isteği DTO'su — e-posta, kullanıcı adı, şifre + ad/soyad zorunludur */
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterEducatorDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: 'Eğiticinin adı (resmi kayıt)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ description: 'Eğiticinin soyadı (resmi kayıt)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;
}
