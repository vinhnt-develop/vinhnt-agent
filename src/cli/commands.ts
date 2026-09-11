import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { loadConfig } from '../config/index.js';
import { AgentRunner } from '../agent/agent-runner.js';
import { AgentServer } from '../server/agent-server.js';
import { logger } from '../common/logger.js';

export function setupCommands(program: Command) {
  program
    .name('vinhnt-agent')
    .description('Local AI agent powered by vinhnt-sdk')
    .version('0.1.0');

  // ============ init ============
  program
    .command('init')
    .description('Initialize a new agent project')
    .action(async () => {
      const spinner = ora('Initializing agent project...').start();

      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'workspaceRoot',
            message: 'Workspace root directory:',
            default: '.',
          },
          {
            type: 'list',
            name: 'provider',
            message: 'Default LLM provider:',
            choices: ['openai', 'anthropic', 'deepseek', 'ollama'],
            default: 'openai',
          },
          {
            type: 'input',
            name: 'apiKey',
            message: 'API key (leave empty to use env var):',
            default: '',
          },
        ]);

        const config = loadConfig({
          workspaceRoot: answers.workspaceRoot,
          model: {
            provider: answers.provider,
            apiKey: answers.apiKey,
            baseUrl: '',
            modelId: '',
            maxSteps: 30,
            maxTokens: 4096,
            temperature: 0.7,
            stepTimeout: 120000,
          },
          sync: { enabled: false, apiUrl: '', apiKey: '' },
          server: { port: 3001, host: 'localhost' },
          dataDir: '.vinhnt-agent',
        });

        spinner.succeed(chalk.green('Agent project initialized!'));
        console.log(chalk.cyan('\nNext steps:'));
        console.log('  1. Set your API key in .env or environment');
        console.log('  2. Run: vinhnt-agent chat');
        console.log('  3. Or start server: vinhnt-agent serve');
      } catch (error) {
        spinner.fail(chalk.red('Initialization failed'));
        console.error(error);
      }
    });

  // ============ chat ============
  program
    .command('chat')
    .description('Start an interactive chat session')
    .option('-s, --session <id>', 'Resume an existing session')
    .option('-m, --model <model>', 'Override model ID')
    .option('-p, --provider <provider>', 'Override provider')
    .action(async (options) => {
      const config = loadConfig();
      const dataDir = config.dataDir;

      const runner = new AgentRunner(config, dataDir);
      const spinner = ora('Initializing agent...').start();

      try {
        await runner.initialize();
        spinner.succeed(chalk.green('Agent ready!'));

        let sessionId = options.session;

        // Create session if new
        if (!sessionId) {
          const session = await runner.getSessionStore().createSession(
            `Chat ${new Date().toLocaleString()}`,
          );
          sessionId = session.id;
        }

        console.log(
          chalk.cyan(`\nSession: ${sessionId}`),
          chalk.gray('(type /exit to quit, /history for messages)\n'),
        );

        const rl = await import('readline');
        const readline = rl.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const ask = () => {
          readline.question(chalk.green('You: '), async (input) => {
            const trimmed = input.trim();

            if (!trimmed) {
              ask();
              return;
            }

            if (trimmed === '/exit') {
              console.log(chalk.gray('\nGoodbye!'));
              readline.close();
              process.exit(0);
            }

            if (trimmed === '/history') {
              const messages = await runner.getSessionStore().listMessages(sessionId as any);
              for (const msg of messages) {
                const role =
                  msg.role === 'user'
                    ? chalk.green('You')
                    : msg.role === 'assistant'
                      ? chalk.blue('Assistant')
                      : chalk.gray(msg.role);
                console.log(`${role}: ${msg.content.slice(0, 200)}...\n`);
              }
              ask();
              return;
            }

            if (trimmed.startsWith('/memory')) {
              const memories = await runner.getMemoryStore().list();
              console.log(chalk.yellow(`\nMemories (${memories.length}):`));
              for (const mem of memories.slice(0, 10)) {
                console.log(`  [${mem.tier}] ${mem.key}: ${mem.value.slice(0, 80)}`);
              }
              console.log();
              ask();
              return;
            }

            const runSpinner = ora('Thinking...').start();

            try {
              const result = await runner.runAgent({
                sessionId,
                prompt: trimmed,
                model: options.model,
                provider: options.provider,
              });

              runSpinner.stop();

              if (result.status === 'succeeded') {
                console.log(chalk.blue(`\nAssistant: ${result.output}\n`));
              } else {
                console.log(chalk.red(`\nError: ${result.output}\n`));
              }
            } catch (error) {
              runSpinner.fail(chalk.red('Run failed'));
              console.error(error);
            }

            ask();
          });
        };

        ask();
      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize agent'));
        console.error(error);
        process.exit(1);
      }
    });

  // ============ run ============
  program
    .command('run <prompt>')
    .description('Run a single prompt (non-interactive)')
    .option('-s, --session <id>', 'Session ID')
    .option('-m, --model <model>', 'Override model ID')
    .option('-p, --provider <provider>', 'Override provider')
    .action(async (prompt, options) => {
      const config = loadConfig();
      const runner = new AgentRunner(config, config.dataDir);

      const spinner = ora('Running agent...').start();

      try {
        await runner.initialize();

        let sessionId = options.session;
        if (!sessionId) {
          const session = await runner.getSessionStore().createSession(
            `Run ${new Date().toLocaleString()}`,
          );
          sessionId = session.id;
        }

        const result = await runner.runAgent({
          sessionId,
          prompt,
          model: options.model,
          provider: options.provider,
        });

        spinner.stop();

        if (result.status === 'succeeded') {
          console.log(result.output);
        } else {
          console.error(chalk.red(`Failed: ${result.output}`));
          process.exit(1);
        }
      } catch (error) {
        spinner.fail(chalk.red('Run failed'));
        console.error(error);
        process.exit(1);
      }
    });

  // ============ serve ============
  program
    .command('serve')
    .description('Start the agent HTTP/WebSocket server')
    .option('-p, --port <port>', 'Server port', '3001')
    .option('-H, --host <host>', 'Server host', 'localhost')
    .action(async (options) => {
      const config = loadConfig({
        server: {
          port: Number(options.port),
          host: options.host,
        },
      } as any);

      const runner = new AgentRunner(config, config.dataDir);
      const server = new AgentServer(config, runner);

      const spinner = ora('Starting agent server...').start();

      try {
        await runner.initialize();
        await server.start();
        spinner.succeed(
          chalk.green(
            `Agent server running at http://${options.host}:${options.port}`,
          ),
        );
        console.log(chalk.cyan('WebSocket: ws://host:port/ws'));
        console.log(chalk.gray('Press Ctrl+C to stop\n'));

        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\nShutting down...'));
          await server.stop();
          await runner.shutdown();
          process.exit(0);
        });
      } catch (error) {
        spinner.fail(chalk.red('Server failed to start'));
        console.error(error);
        process.exit(1);
      }
    });

  // ============ sessions ============
  program
    .command('sessions')
    .description('List all sessions')
    .action(async () => {
      const config = loadConfig();
      const { LocalSessionStore } = await import('../storage/local-session-store.js');
      const store = new LocalSessionStore(config.dataDir);

      const sessions = await store.listSessions();

      if (sessions.length === 0) {
        console.log(chalk.gray('No sessions found.'));
        return;
      }

      console.log(chalk.cyan(`\nSessions (${sessions.length}):`));
      for (const s of sessions) {
        const status = s.isActive ? chalk.green('active') : chalk.gray('inactive');
        console.log(
          `  ${chalk.yellow(s.id)} ${status} ${s.title || 'Untitled'} ${chalk.gray(s.createdAt)}`,
        );
      }
      console.log();
    });

  // ============ memories ============
  program
    .command('memories')
    .description('List all memories')
    .option('-t, --tier <tier>', 'Filter by tier')
    .action(async (options) => {
      const config = loadConfig();
      const { LocalMemoryStore } = await import('../storage/local-memory-store.js');
      const store = new LocalMemoryStore(config.dataDir);

      let memories;
      if (options.tier) {
        memories = await store.listByTier(options.tier, '');
      } else {
        memories = await store.list();
      }

      if (memories.length === 0) {
        console.log(chalk.gray('No memories found.'));
        return;
      }

      console.log(chalk.cyan(`\nMemories (${memories.length}):`));
      for (const m of memories) {
        console.log(
          `  [${chalk.yellow(m.tier)}] ${chalk.green(m.key)}: ${m.value.slice(0, 100)}`,
        );
      }
      console.log();
    });

  // ============ tools ============
  program
    .command('tools')
    .description('List available tools')
    .action(async () => {
      const config = loadConfig();
      const { LocalAgentToolkit } = await import('../agent/local-toolkit.js');
      const toolkit = new LocalAgentToolkit(config.workspaceRoot);
      toolkit.initializeTools();

      const tools = toolkit.getToolsAsDefinitions();

      console.log(chalk.cyan(`\nAvailable tools (${tools.length}):`));
      for (const t of tools) {
        console.log(`  ${chalk.green(t.name)}: ${chalk.gray(t.description.slice(0, 80))}`);
      }
      console.log();
    });
}
