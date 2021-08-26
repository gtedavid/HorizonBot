import { ApplyOptions } from '@sapphire/decorators';
import type { Args, CommandOptions } from '@sapphire/framework';
import { BucketScope } from '@sapphire/framework';
import axios from 'axios';
import { MessageEmbed } from 'discord.js';
import pupa from 'pupa';
import { code as config } from '@/config/commands/general';
import settings from '@/config/settings';
import MonkaCommand from '@/structures/commands/MonkaCommand';
import type { GuildMessage } from '@/types';
import { convertSize } from '@/utils';

const wraps = new Map([
  ['c', '#include <stdio.h>\n#include <stdlib.h>\nint main() { {code} }'],
  ['cpp', '#include <iostream>\nint main() { {code} }'],
  ['java', 'public class Main {\n\tpublic static void main(String[] args) {\n\t{code}\n\t}\n}'],
  ['javascript', ';(async () => { {code} } )();'],
]);

@ApplyOptions<CommandOptions>({
  ...config.options,
  quotes: [],
  flags: ['wrap'],
  options: ['input'],
  preconditions: [{
    name: 'Cooldown',
    context: {
      // TODO?: Make it Guild?
      bucketType: BucketScope.User,
      delay: 60_000,
      limit: 3,
      silent: true,
    },
  }],
})
export default class CodeCommand extends MonkaCommand {
  public async run(message: GuildMessage, args: Args): Promise<void> {
    if (this.container.client.remainingCompilerApiCredits <= 0) {
      await message.channel.send(config.messages.noMoreCredits);
      return;
    }

    const lang = await args.pickResult('codeLanguage');
    if (lang.error) {
      if (['info', 'infos', 'information', 'informations'].includes(lang.error.parameter)) {
        await this._showInfos(message);
        return;
      }
      await message.channel.send(pupa(config.messages.unknownLanguage, { parameter: lang.error.parameter }));
      return;
    }

    const shouldWrap = args.getFlags('wrap');
    const input = args.getOption('input');

    const codeArg = await args.restResult('code');
    if (codeArg.error) {
      await message.channel.send(config.messages.noCode);
      return;
    }
    let code = codeArg.value;
    if (shouldWrap)
      code = pupa(wraps.get(lang.value.language), { code });

    void message.channel.sendTyping();

    let response = { data: { cpuTime: 0, memory: 0, output: code } };
    if (settings.configuration.enableCompilerApi) {
      this.container.client.remainingCompilerApiCredits--;
      response = await axios.post(settings.apis.compiler, {
        script: code,
        stdin: input,
        language: lang.value.language,
        versionIndex: lang.value.versionIndex,
        clientId: process.env.COMPILERAPI_ID,
        clientSecret: process.env.COMPILERAPI_SECRET,
      });
    }

    await message.reply(
      pupa(config.messages.result, {
        message,
        lang,
        cpuTime: response.data.cpuTime ?? 0,
        memory: convertSize(response.data.memory),
      }),
    );
    // Ph (placeholder) prevents Discord from taking the first line as a language identifier for markdown and remove it
    await message.channel.send(`\`\`\`ph\n${response.data.output}\`\`\``);
  }

  private async _showInfos(message: GuildMessage): Promise<void> {
    const embed = new MessageEmbed()
      .setColor(settings.colors.default)
      .addFields(
        settings.languages.map(lang => ({
          name: lang.display,
          value: pupa(config.messages.informationBlock, { lang, formattedSlugs: `\`${lang.slugs.join('`, `')}\`` }),
          inline: true,
        })),
      );
    await message.channel.send({ embeds: [embed] });
  }
}
