import { Global, Module } from '@nestjs/common';
import { KernelSettingsStore } from './kernel-settings.store';

/**
 * Registers KernelSettingsStore globally (SC3): both ProjectPathModule and
 * AgentModule need it, neither should import the other.
 */
@Global()
@Module({
  providers: [KernelSettingsStore],
  exports: [KernelSettingsStore],
})
export class KernelSettingsModule {}
