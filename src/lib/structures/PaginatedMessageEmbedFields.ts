/**
 * @credits This class is adapted from the PaginatedFieldMessageEmbed class, proposed by
 * kaname-png in this PR: https://github.com/sapphiredev/utilities/pull/144
 *
 * SPDX-License-Identifier: MIT
 */

import type { PaginatedMessageOptions, PaginatedMessagePage } from '@sapphire/discord.js-utilities';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import type { APIEmbed, EmbedField, JSONEncodable } from 'discord.js';
import { ComponentType, EmbedBuilder } from 'discord.js';
import pupa from 'pupa';
import messages from '@/config/messages';
import settings from '@/config/settings';

type EmbedFields = Array<Omit<EmbedField, 'inline'>>;

export default class PaginatedMessageEmbedFields extends PaginatedMessage {
  private _embedTemplate: APIEmbed = {};
  private _totalPages = 0;
  private _items: EmbedFields = [];
  private _itemsPerPage = 10;

  constructor(options?: PaginatedMessageOptions) {
    super(options);
    this.setWrongUserInteractionReply(user => ({
      content: pupa(messages.errors.wrongUserInteractionReply, { user }),
      ephemeral: true,
      allowedMentions: { users: [], roles: [] },
    }));
  }

  public setItems(items: EmbedFields): this {
    this._items = items;
    return this;
  }

  public setItemsPerPage(itemsPerPage: number): this {
    this._itemsPerPage = itemsPerPage;
    return this;
  }

  public setTemplate(template: APIEmbed | JSONEncodable<APIEmbed>): this {
    this._embedTemplate = 'toJSON' in template ? template.toJSON() : template;
    return this;
  }

  public override addPage(page: PaginatedMessagePage): this {
    if (this.pages.length === 25) {
      const actions = PaginatedMessage.defaultActions.filter(action =>
        action.type !== ComponentType.StringSelect);
      this.setActions(actions);
    }

    this.pages.push(page);
    return this;
  }

  public make(): this {
    this._totalPages = Math.ceil(this._items.length / this._itemsPerPage);
    this._generatePages();
    return this;
  }

  private _generatePages(): void {
    const template = this._embedTemplate;
    for (let i = 0; i < this._totalPages; i++) {
      const clonedTemplate = EmbedBuilder.from({ ...template, fields: [] });
      const fieldsClone = this._embedTemplate.fields ?? [];

      if (!template.color)
        clonedTemplate.setColor(settings.colors.default);

      const data = this._paginateArray(this._items, i, this._itemsPerPage);
      this.addPage({
        embeds: [clonedTemplate.addFields(data).addFields(fieldsClone)],
      });
    }
  }

  private _paginateArray(items: EmbedFields, currentPage: number, perPageItems: number): EmbedFields {
    const offset = currentPage * perPageItems;
    return items.slice(offset, offset + perPageItems);
  }
}
