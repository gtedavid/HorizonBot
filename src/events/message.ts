import { Event } from '@sapphire/framework';
import settings from '@/config/settings';
import RoleIntersections from '@/models/roleIntersections';
import FlaggedMessage from '@/structures/FlaggedMessage';
import type { GuildMessage } from '@/types';

export default class MessageEvent extends Event {
  public async run(message: GuildMessage): Promise<void> {
    if (message.author.bot || message.system)
      return;

    const mentionnedTempIntersectionRoles = this.context.client.intersectionRoles
      .filter(r => message.mentions.roles.has(r))
      .map(roleId => message.guild.roles.resolve(roleId));
    if (mentionnedTempIntersectionRoles.length > 0) {
      this.context.logger.info(`[Intersection Roles] ${mentionnedTempIntersectionRoles.length} role was just mentionned by ${message.author.username}. It will expire in two days.`);

      for (const role of mentionnedTempIntersectionRoles) {
        await RoleIntersections.findOneAndUpdate(
          { roleId: role.id, guildId: role.guild.id },
          { expiration: Date.now() + settings.configuration.roleIntersectionExpiration },
          { upsert: true },
        );
      }
    }

    // Swearing check
    const swear = settings.configuration.swears.find(swr => message.cleanContent.split(' ').includes(swr));
    if (swear && !message.member.roles.cache.has(settings.roles.staff))
      await new FlaggedMessage(message, { swear }).start();
  }
}
