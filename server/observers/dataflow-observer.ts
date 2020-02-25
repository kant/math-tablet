/*
Math Tablet
Copyright (C) 2019 Public Invention
https://pubinv.github.io/PubInv/

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// This file is a place to put experimental observer functionality on a temporary basis.

// Requirements

import * as debug1 from 'debug';
const MODULE = __filename.split(/[/\\]/).slice(-1)[0].slice(0,-3);
const debug = debug1(`server:${MODULE}`);

import { NotebookChange, StyleObject, RelationshipObject } from '../../client/notebook';
import { NotebookChangeRequest } from '../../client/math-tablet-api';
import { ServerNotebook, ObserverInstance  } from '../server-notebook';
import { Config } from '../config';

// Types

enum DataflowStatus {
  Invalid = -1,
  Unchanged = 0,
  Changed = 1,
}

export interface DataflowValue {
  status: DataflowStatus;
  message?: string;   // If status is 'CHANGED' or 'UNCHANGED'
  value?: any;        // If status is 'INVALED'
}

export type DataflowAsyncFunction = (relationship: RelationshipObject, inputValues: DataflowValue[]) => Promise<DataflowValue[]>;
export type DataflowSyncFunction = (relationship: RelationshipObject, inputValues: DataflowValue[]) => DataflowValue[];

// Exported Class

export class DataflowObserver implements ObserverInstance {

  // Class Methods

  public static async initialize(_config: Config): Promise<void> {
    debug(`initialize`);
  }

  public static async onOpen(notebook: ServerNotebook): Promise<ObserverInstance> {
    debug(`onOpen`);
    return new this(notebook);
  }

  // Instance Methods

  public async onChangesAsync(changes: NotebookChange[]): Promise<NotebookChangeRequest[]> {
    const rval: NotebookChangeRequest[] = [];
    for (const change of changes) {
      const changeRequests = await this.onChangeAsync(change);
      rval.push(...changeRequests);
    }
    return rval;
  }

  public onChangesSync(changes: NotebookChange[]): NotebookChangeRequest[] {
    const rval: NotebookChangeRequest[] = [];
    for (const change of changes) {
      const changeRequests = this.onChangeSync(change);
      rval.push(...changeRequests);
    }
    return rval;
  }

  public async onClose(): Promise<void> {
    debug(`onClose ${this.notebook._path}`);
    delete this.notebook;
  }

  public async useTool(style: StyleObject): Promise<NotebookChangeRequest[]> {
    debug(`useTool ${this.notebook._path} ${style.id}`);
    return [];
  }

  // --- PRIVATE ---

  // Private Constructor

  private constructor(notebook: ServerNotebook) {
    this.notebook = notebook;
  }

  // Private Instance Properties

  private notebook: ServerNotebook;

  // Private Instance Methods

  private onChangeSync(change: NotebookChange): NotebookChangeRequest[] {
    debug(`sync change:  ${this.notebook._path} ${change.type}`);
    const rval: NotebookChangeRequest[] = [];
    switch(change.type) {
      case 'relationshipDeleted':
      case 'relationshipInserted':
      case 'styleChanged':
      case 'styleConverted':
      case 'styleDeleted':
      case 'styleInserted':
      case 'styleMoved':
        break;
    }
    return rval;
  }

  private async onChangeAsync(change: NotebookChange): Promise<NotebookChangeRequest[]> {
    debug(`async change:  ${this.notebook._path} ${change.type}`);
    return [];
  }
}
