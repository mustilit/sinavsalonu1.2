import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LiveOptionDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class LiveQuestionDto {
  // Soru içeriği VEYA mediaUrl olmalı. Use case'de cross-field doğrulama yapılır.
  // Frontend görsel-only sorulara izin verir; eski @IsNotEmpty() bunu engelliyordu.
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LiveOptionDto)
  options!: LiveOptionDto[];
}

export class CreateLiveSessionDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  tierId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LiveQuestionDto)
  questions!: LiveQuestionDto[];
}
