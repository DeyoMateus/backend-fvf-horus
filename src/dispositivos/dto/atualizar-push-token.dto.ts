import { IsString, Length } from 'class-validator';

export class AtualizarPushTokenDto {
  /** Token do Expo Push (formato "ExponentPushToken[...]"), obtido pelo próprio app. */
  @IsString()
  @Length(10, 200)
  pushToken!: string;
}
