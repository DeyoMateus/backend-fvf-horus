import { jest } from '@test/jest-globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prismaMock: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prismaMock = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any;

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('retorna status ok quando o banco responde', async () => {
      const resultado = await appController.health();
      expect(resultado.status).toBe('ok');
      expect(resultado.database).toBe('ok');
    });

    it('lança ServiceUnavailableException quando o banco falha', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('conexão recusada'));
      await expect(appController.health()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
