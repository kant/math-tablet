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

import * as debug1 from 'debug';
const MODULE = __filename.split(/[/\\]/).slice(-1)[0].slice(0,-3);
const debug = debug1(`server:${MODULE}`);
import * as mathsteps from 'mathsteps';
import * as math from 'mathjs';

import { StyleObject, NotebookChange, StyleProperties, ToolInfo, NotebookChangeRequest, StyleInsertRequest } from '../../client/math-tablet-api';
import { TDoc, ObserverInstance }  from '../tdoc';
import { Config } from '../config';

// Types

export interface Step {
  changeType: string;
  newEquation?: any; // TYPESCRIPT: mathsteps.Equation;
  newNode?: math.MathNode;
  oldEquation?: any; // TYPESCRIPT: mathsteps.Equation;
  oldNode?: math.MathNode;
  substeps: Step[];
}

// Constants

// Exported Class

export class MathStepsObserver implements ObserverInstance {

  // Class Methods

  public static async initialize(_config: Config): Promise<void> {
    debug(`initialize`);
  }

  public static async onOpen(tDoc: /* REVIEW: ReadOnlyTDoc */TDoc): Promise<ObserverInstance> {
    debug(`onOpen`);
    return new this(tDoc);
  }

  // Instance Methods

  public async onChanges(changes: NotebookChange[]): Promise<NotebookChangeRequest[]> {
    debug(`onChanges ${changes.length}`);
    const rval: NotebookChangeRequest[] = [];
    for (const change of changes) {
      await this.onChange(change, rval);
    }
    debug(`onChanges returning ${rval.length} changes.`);
    return rval;
  }

  public async onClose(): Promise<void> {
    debug(`onClose ${this.tDoc._path}`);
    delete this.tDoc;
  }

  public async useTool(toolStyle: StyleObject): Promise<NotebookChangeRequest[]> {
    debug(`useTool ${this.tDoc._path} ${toolStyle.id}`);

    const parentStyle = this.tDoc.getStyleById(toolStyle.parentId);

    const isExpression: boolean = toolStyle.data.data.expr;
    const steps: Step[] = (isExpression ?
                            mathsteps.simplifyExpression(parentStyle.data) :
                            mathsteps.solveEquation(parentStyle.data));
    const data: string = `<pre>\n${formatSteps(steps)}</pre>`;

    const changeReq: StyleInsertRequest = {
      type: 'insertStyle',
      styleProps: { type: 'HTML', meaning: 'EXPOSITION', data },
      afterId: parentStyle.id,
    };

    // TODO: Add a relationship between this thought and the original thought.
    // TODO: If original thought changes, then remove/update this simplification.
    return [ changeReq ];
  }

  // --- PRIVATE ---

  // Private Constructor

  private constructor(tDoc: TDoc) {
    this.tDoc = tDoc;
  }

  // Private Instance Properties

  private tDoc: TDoc;

  // Private Instance Methods

  private async onChange(change: NotebookChange, rval: NotebookChangeRequest[]): Promise<void> {
    debug(`onChange ${this.tDoc._path} ${change.type}`);
    switch (change.type) {
      case 'styleInserted': this.chStyleInserted(change.style, rval); break;
      default: break;
    }
  }

  private async chStyleInserted(style: StyleObject, rval: NotebookChangeRequest[]): Promise<void> {
    debug(`onStyleInserted ${style.id} ${style.parentId} ${style.type} ${style.meaning}`);

    // Only try to simplify/solve MathJS expressions
    if (style.type!='MATHJS') { return; }
    if (style.meaning!='INPUT' && style.meaning!='INPUT-ALT') { return; }

    // Try to simplify it as an expression
    const steps: Step[] = mathsteps.simplifyExpression(style.data);
    if (steps.length > 0) {

      const parentStyle = (style.meaning == 'INPUT' ? style : this.tDoc.getStyleById(style.parentId));
      const toolInfo: ToolInfo = { name: 'steps', html: 'Steps', data: { expr: true } };
      const styleProps: StyleProperties = { type: 'TOOL', meaning: 'ATTRIBUTE', data: toolInfo };
      const changeReq: StyleInsertRequest = {
        type: 'insertStyle',
        parentId: parentStyle.id,
        styleProps: styleProps,
      };
      rval.push(changeReq);
    } else {

      // Doesn't simplify as expression. Try to solve it as an equation.
      const steps2: Step[] = mathsteps.solveEquation(style.data);
      if (steps2.length > 0) {
        const parentStyle = (style.meaning == 'INPUT' ? style : this.tDoc.getStyleById(style.parentId));
        const toolInfo: ToolInfo = { name: 'steps', html: 'Steps', data: { expr: false } };
        const styleProps: StyleProperties = { type: 'TOOL', meaning: 'ATTRIBUTE', data: toolInfo };
        const changeReq: StyleInsertRequest = {
          type: 'insertStyle',
          parentId: parentStyle.id,
          styleProps: styleProps,
        };
        rval.push(changeReq);
      }
    }
  }

}

// Helper Functions

// WARNING: Input "a = 3/27","b = 6/27", "c = a + b" appears
// to cause an error here.

function formatStep(step: Step, level: number): string {
  const indent = '  '.repeat(level);
  let rval = `${indent}${step.changeType}\n`;
  if (step.oldNode) {
    rval += `${indent}FROM: ${step.oldNode.toString()}\n`;
  }
  if (step.oldEquation) {
    rval += `${indent}FROM: ${step.oldEquation.ascii()}\n`;
  }
  if (step.newNode) {
    rval += `${indent}  TO: ${step.newNode.toString()}\n`;
  }
  if (step.newEquation) {
    rval += `${indent}  TO: ${step.newEquation.ascii()}\n`;
  }
  if (step.substeps.length>0) {
    rval += formatSteps(step.substeps, level+1);
  }
  return rval;
}

function formatSteps(steps: Step[], level: number = 0): string {
  const indent = '  '.repeat(level);
  let rval: string;
  if (steps.length == 0) {
    rval = `${indent}NO STEPS`;
  } else {
    rval = '';
    for (const step of steps) {
      rval += formatStep(step, level);
    }
  }
  return rval;
}
