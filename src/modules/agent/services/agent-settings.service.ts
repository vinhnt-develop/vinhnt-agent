import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface KernelSettings {
  // LLM Settings
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxSteps: number;
  thinkingBudget: number;
  stepTimeout: number;

  // Tool Behavior
  toolChoice: 'auto' | 'none' | 'required';
  parallelToolCalls: boolean;
  maxToolCallsPerStep: number;
  maxConcurrentToolCalls: number;

  // Behavior
  selfCorrectOnFailure: boolean;
  maxSelfCorrectAttempts: number;
  compactionThreshold: number;
  doomLoopThreshold: number;
  maxSubAgentDepth: number;

  // Resilience
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;

  // Sandbox
  sandboxMode: 'host' | 'process' | 'container';

  // System
  systemPrompt: string;
}

const DEFAULT_SETTINGS: KernelSettings = {
  temperature: 0.7,
  topP: 1.0,
  maxTokens: 4096,
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxSteps: 30,
  thinkingBudget: 1024,
  stepTimeout: 120000,
  toolChoice: 'auto',
  parallelToolCalls: true,
  maxToolCallsPerStep: 10,
  maxConcurrentToolCalls: 5,
  selfCorrectOnFailure: true,
  maxSelfCorrectAttempts: 3,
  compactionThreshold: 0.75,
  doomLoopThreshold: 3,
  maxSubAgentDepth: 3,
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  sandboxMode: 'host',
  systemPrompt: '',
};

@Injectable()
export class AgentSettingsService {
  private readonly logger = new Logger(AgentSettingsService.name);
  private readonly settingsPath: string;
  private settings: KernelSettings = { ...DEFAULT_SETTINGS };

  constructor(private readonly configService: ConfigService) {
    const configDir = this.configService.get<string>('CONFIG_DIR', path.join(process.cwd(), 'config'));
    this.settingsPath = path.join(configDir, 'kernel-settings.json');
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const saved = JSON.parse(data);
        this.settings = { ...DEFAULT_SETTINGS, ...saved };
        this.logger.log(`Loaded kernel settings from ${this.settingsPath}`);
      } else {
        this.saveSettings();
      }
    } catch (error) {
      this.logger.warn('Failed to load kernel settings, using defaults', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save kernel settings', error);
    }
  }

  getSettings(): KernelSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<KernelSettings>): KernelSettings {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
    this.logger.log('Kernel settings updated');
    return this.getSettings();
  }

  resetSettings(): KernelSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.logger.log('Kernel settings reset to defaults');
    return this.getSettings();
  }
}
