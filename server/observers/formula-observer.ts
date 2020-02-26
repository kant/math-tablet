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

// Requirements

import debug1 from 'debug';

import { BaseObserver, Rules, StyleRelation } from './base-observer';
import { ServerNotebook } from '../server-notebook';
import { WolframData } from '../../client/math-tablet-api';
import { FormulaData } from '../../client/notebook';

const MODULE = __filename.split(/[/\\]/).slice(-1)[0].slice(0,-3);
const debug = debug1(`server:${MODULE}`);

// Constants

// Exported Class

export class FormulaObserver extends BaseObserver {

  // --- OVERRIDES ---

  protected get rules(): Rules { return FormulaObserver.RULES; }

  // --- PUBLIC ---

  public static async onOpen(notebook: ServerNotebook): Promise<FormulaObserver> {
    debug(`Opening FormulaObserver for ${notebook._path}.`);
    return new this(notebook);
  }

  // --- PRIVATE ---

  // Private Class Constants

  private static RULES: Rules = [
    {
      name: "parseWolframInput",
      styleTest: {
        role: 'REPRESENTATION',
        subrole: 'INPUT',
        source: 'USER',
        type: 'WOLFRAM',
      },
      styleRelation: StyleRelation.Child,
      props: {
        role: 'FORMULA',
        // subrole: 'ALTERNATE',
        type: 'FORMULA-DATA',
      },
      computeSync: FormulaObserver.parseWolframInput,
    },
  ];

  // Private Class Methods

  private static parseWolframInput(wolframData: WolframData): FormulaData {
    return { wolframData };
  }

  // Private Constructor

  protected constructor(notebook: ServerNotebook) { super(notebook); }

}

// HELPER FUNCTIONS
