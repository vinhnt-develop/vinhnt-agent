import { Controller, Get, Put, Body, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AgentSettingsService } from '../services/agent-settings.service';
import type { KernelSettings } from '../services/agent-settings.service';

@ApiTags('Agent Settings')
@Controller({ path: 'agent/settings', version: '1' })
export class AgentSettingsController {
  constructor(private readonly settingsService: AgentSettingsService) {}

  @Get('kernel')
  @ApiOperation({ summary: 'Get kernel settings' })
  getKernelSettings(): KernelSettings {
    return this.settingsService.getSettings();
  }

  @Put('kernel')
  @ApiOperation({ summary: 'Update kernel settings' })
  updateKernelSettings(@Body() body: Partial<KernelSettings>): KernelSettings {
    return this.settingsService.updateSettings(body);
  }

  @Post('kernel/reset')
  @ApiOperation({ summary: 'Reset kernel settings to defaults' })
  resetKernelSettings(): KernelSettings {
    return this.settingsService.resetSettings();
  }
}
