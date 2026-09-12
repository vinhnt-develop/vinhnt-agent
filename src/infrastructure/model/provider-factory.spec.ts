import { Test, TestingModule } from '@nestjs/testing';
import { ProviderFactory, type ProviderConfig } from './provider-factory';
import { DATABASE_CONNECTION } from '@/infrastructure/database/database-connection';

jest.mock('@vinhnt-sdk/provider-openai-compatible', () => ({
  OpenAICompatibleProvider: jest.fn().mockImplementation(() => ({
    provider: 'test',
    model: 'test-model',
    contextLimit: undefined,
    pricing: undefined,
    capabilities: { streaming: true, toolCalling: true },
    generate: jest.fn(),
    stream: jest.fn(),
  })),
}));

jest.mock('@vinhnt-sdk/llm', () => ({
  TokenMeter: jest.fn().mockImplementation(() => ({
    estimateRequest: jest.fn().mockReturnValue(100),
    estimateMessage: jest.fn().mockReturnValue(50),
    estimateText: jest.fn().mockReturnValue(25),
    measurePressure: jest.fn().mockReturnValue(0.5),
    projectNextRequest: jest.fn().mockReturnValue(150),
  })),
}));

describe('ProviderFactory', () => {
  let factory: ProviderFactory;

  beforeEach(async () => {
    const mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderFactory,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    factory = module.get<ProviderFactory>(ProviderFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('buildProvider', () => {
    it('should create a provider from config', () => {
      const config: ProviderConfig = {
        provider: 'test-provider',
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'sk-test',
      };

      const provider = factory.buildProvider(config);
      expect(provider).toBeDefined();
      expect(provider.provider).toBe('test-provider');
    });
  });
});
