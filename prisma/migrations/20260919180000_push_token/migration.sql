-- Expo push token do dispositivo vinculado, para notificações críticas
-- de jornada direto no celular do motorista.
ALTER TABLE "dispositivos_vinculados" ADD COLUMN "pushToken" TEXT;
