import { Listener } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { AuditLogEvent } from 'discord.js';
import * as DiscordLogManager from '@/structures/logs/DiscordLogManager';
import { DiscordLogType } from '@/types/database';
import { nullop } from '@/utils';

export default class GuildMemberUpdateListener extends Listener {
  public run(oldMember: GuildMember, newMember: GuildMember): void {
    void this._logNicknameChanges(oldMember, newMember);
    void this._logRoleChanges(oldMember, newMember);
  }

  private async _logNicknameChanges(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    if (oldMember.nickname !== newMember.nickname) {
      const auditLogs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate }).catch(nullop);
      const lastMemberUpdate = auditLogs?.entries.filter(entry => entry.target?.id === newMember.id).first();

      // Tell executor ID
      await DiscordLogManager.logAction({
        type: DiscordLogType.MemberNicknameUpdate,
        context: { executorId: lastMemberUpdate?.executor?.id, userId: newMember.id },
        content: { before: oldMember.displayName, after: newMember.displayName },
        guildId: newMember.guild.id,
        severity: 1,
      });
    }
  }

  private async _logRoleChanges(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    if (oldRoles.equals(newRoles))
      return;

    const addedRoles = newRoles
      .filter(role => !oldRoles.has(role.id))
      .keys()
      .toArray();
    const removedRoles = oldRoles
      .filter(role => !newRoles.has(role.id))
      .keys()
      .toArray();

    const auditLogs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate }).catch(nullop);
    const lastMemberRoleUpdate = auditLogs?.entries.filter(entry => entry.target?.id === newMember.id).first();

    if (addedRoles.length > 0) {
      await DiscordLogManager.logAction({
        type: DiscordLogType.MemberRoleAdd,
        context: {
          executorId: lastMemberRoleUpdate?.executor?.id,
          userId: newMember.id,
        },
        content: addedRoles,
        guildId: newMember.guild.id,
        severity: 1,
      });
    }

    if (removedRoles.length > 0) {
      await DiscordLogManager.logAction({
        type: DiscordLogType.MemberRoleRemove,
        context: {
          executorId: lastMemberRoleUpdate?.executor?.id,
          userId: newMember.id,
        },
        content: removedRoles,
        guildId: newMember.guild.id,
        severity: 1,
      });
    }
  }
}
