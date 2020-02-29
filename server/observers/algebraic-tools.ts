/*
  Math Tablet
  Copyright (C) 2019 Public Invention
  https://pubinv.github.io/PubInv/

  This program is free software: you can redistribute it and/or modify
  oit under the terms of the GNU Affero General Public License as published by
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

import { StyleType,NotebookChange, StyleObject,
         RelationshipObject,
         RelationshipProperties,
         HintData, HintRelationship, HintStatus, FormulaData} from '../../client/notebook';
import {
  ToolInfo, NotebookChangeRequest, StyleInsertRequest, StyleDeleteRequest, StylePropertiesWithSubprops, WolframData,
  ToolData,RelationshipInsertRequest,
} from '../../client/math-tablet-api';

import {
  DataflowStatus,
  DataflowValue
} from '../../server/observers/dataflow-observer';

import { ServerNotebook, ObserverInstance } from '../server-notebook';
import { execute,  convertWolframToTeX} from '../wolframscript';
import { Config } from '../config';

// Types

// Exported Class

export class AlgebraicToolsObserver implements ObserverInstance {

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
//    debug(`onChanges ${changes.length}`);
    const rval: NotebookChangeRequest[] = [];
    for (const change of changes) {
      await this.onChange(change, rval);
    }
//    debug(`onChanges returning ${rval.length} changes.`);
    return rval;
  }

  public onChangesSync(_changes: NotebookChange[]): NotebookChangeRequest[] {
    return [];
  }

  public async onClose(): Promise<void> {
    debug(`onClose ${this.notebook._path}`);
    delete this.notebook;
  }

  // TODO: This is a direct duplicate code in symbol-classifier.ts
  // that duplication must be removed.
  public async useTool(toolStyle: StyleObject): Promise<NotebookChangeRequest[]> {
//    debug(`useTool ${this.notebook._path} ${toolStyle.id}`);

    const toolInfo: ToolInfo = toolStyle.data;
    const toolData: ToolData = toolInfo.data;

    //    const fromId = toolInfo.origin_id!;

    // We made a design decision that the relationship
    // is from top level formula and to top level formula

    debug("xxx",toolInfo);

    const origin_top = this.notebook.topLevelStyleOf(toolInfo.origin_id!);
    var fromId : number;
    if (origin_top.role == 'FORMULA' && origin_top.type == 'FORMULA-DATA') {
      fromId = origin_top.id;
    } else {
      fromId = this.notebook.findStyle({role: 'FORMULA', type: 'FORMULA-DATA',recursive: true },
                               origin_top!.id)!.id;
    }

    const toId = this.notebook.reserveId();
    const hintId = this.notebook.reserveId();
    const relId = this.notebook.reserveId();

    const data: HintData = {
      relationship: HintRelationship.Equivalent,
      status: HintStatus.Correct,
      idOfRelationshipDecorated: relId
    };

    const hintProps: StylePropertiesWithSubprops = {
      role: 'HINT', type: 'HINT-DATA', data,
      id: hintId,
      subprops: [
        { role: 'REPRESENTATION', subrole: 'INPUT', type: 'TEXT', data: `From ${toolInfo.name}` },
      ]
    };
    const hintReq: StyleInsertRequest = {
      type: 'insertStyle',
      // TODO: afterId should be ID of subtrivariate.
      styleProps: hintProps,
    };

    // I believe the "id" in relationsFrom is not working below!!!
    // const styleProps: StylePropertiesWithSubprops = {
    //   role: 'FORMULA',
    //   type: 'FORMULA-DATA',
    //   data: { wolframData: toolData.output },
    //   relationsFrom: {
    //     [fromId]: { role: 'TRANSFORMATION',
    //                 data: toolData,
    //                 id: relId },
    //   }
    // };

    const formulaData: FormulaData = { wolframData: toolData.output };
    const styleProps: StylePropertiesWithSubprops = {
      id: toId,
      role: 'FORMULA',
      type: 'FORMULA-DATA',
      data: formulaData,
    };

    const changeReq: StyleInsertRequest = {
      type: 'insertStyle',
      // TODO: afterId should be ID of subtrivariate.
      styleProps,
    };

    const relProps : RelationshipProperties =
      { role: 'TRANSFORMATION',
        data: toolData.transformation, // Change this to Wolfram expression
        dataflow: true,
        id: relId,
        logic: HintRelationship.Equivalent,
        status: HintStatus.Correct,
      };

    const relReq: RelationshipInsertRequest =
      { type: 'insertRelationship',
        fromId,
        toId,
        inStyles: [
                    { role: 'INPUT-FORMULA', id: fromId},
                    { role: 'TRANSFORMATION-TOOL', id: toolStyle.id}
                  ],
        outStyles: [
                     { role: 'OUTPUT-FORMULA', id: toId},
                     { role: 'TRANSFORMATION-HINT', id: hintId}
                   ],
        props: relProps };

    return [ hintReq, changeReq, relReq ];
  }

  // --- PRIVATE ---

  // Private Constructor

  private constructor(notebook: ServerNotebook) {
    this.notebook = notebook;
  }

  // Private Instance Properties

  private notebook: ServerNotebook;

  // Private Instance Methods

  private async onChange(change: NotebookChange, rval: NotebookChangeRequest[]): Promise<void> {
//    debug(`onChange ${this.notebook._path} ${change.type}`);
    switch (change.type) {
      case 'styleInserted': {
        await this.algebraicToolsStyleInsertRule(change.style, rval);
        break;
      }
      case 'styleChanged': {
        //        await this.algebraicToolsStyleChangeRule(change.style, rval);
        break;
      }
        // case 'relationshipInserted':
        //   await this.algebraicToolsChangedRule(change.relationship, rval);
        //   break;
        // case 'relationshipDeleted':
        //   await this.algebraicToolsChangedRule(change.relationship, rval);
        //   break;
      default: break;
    }
  }

  private effectiveEqual(a : string,b :string) : boolean {
    const ae = a.replace( / \r?\n|\r/g,"");
    const be = b.replace( / \r?\n|\r/g,"");
    return ae === be;
  }
  private async addTool(style : StyleObject,
                        rval: NotebookChangeRequest[],
                        transformation: WolframData,
                        name: string,
                        html_fun: (s: string) => string,
                        tex_fun: (s: string) => string) :
  Promise<void> {
    //    const f = await this.factor(style.data);
    const input = transformation.replace('${expr}', style.data);
    const output = await execute(input);
    if (this.effectiveEqual(output,style.data)) { // nothing interesting to do!
      return;
    }

    // WARNING: I'm producing LaTeX here, but I am not handling variable
    // substitutions or changes. This will likely not work very well
    // in the presence of those things.  However, this will let DEJ do
    // some rendering work on the tool side immediately. I will have to
    // come back in and handle this more complete later. - rlr

    const tex_f : string = await convertWolframToTeX(output);

    // (Actually we want to put the LaTeX in here, but that is a separate step!
    const data = { output, transformation, transformationName: name };
    const toolInfo: ToolInfo = { name: name,
                                 html: html_fun(output),
                                 tex: tex_fun(tex_f),
                                 data,
                                 origin_id: style.id};
    const styleProps2: StylePropertiesWithSubprops = {
      type: 'TOOL',
      role: 'ATTRIBUTE',
      data: toolInfo,
    }
    const changeReq2: StyleInsertRequest = {
      type: 'insertStyle',
      parentId: style.id,
      styleProps: styleProps2
    };
    rval.push(changeReq2);
  }

  // This will be needed soon, but is not in use now - rlr
  // @ts-ignore
  private removeAllOffspringOfType(obj: StyleObject,
                                   rval: NotebookChangeRequest[], typeToRemove: StyleType) {
    const kids : StyleObject[] =
      this.notebook.findStyles({ type: typeToRemove, recursive: true }, obj.id);
    kids.forEach(k => {
      const changeReq: StyleDeleteRequest = {
        type: 'deleteStyle',
        styleId: k.id
      };
      rval.push(changeReq);
    });

  }

  // private checkUserInputChangeRule(style: StyleObject, rval: NotebookChangeRequest[]) : void {
  //   if (style.role == 'REPRESENTATION') {
  //     debug("found Representation change!");
  //     // This means the user changed it, I am not sure the
  //     // GUI is correctly updateing types in this case!
  //     // It seems that the SOURCE should change to USER-DATA

  //     const relOp : FindRelationshipOptions = {
  //       toId: style.id,
  //       role: 'TRANSFORMATION' };

  //     const relsInPlace : RelationshipObject[] = this.notebook.findRelationships(relOp);
  //     relsInPlace.forEach( r => {
  //       const rdr : RelationshipDeleteRequest = {
  //         type: 'deleteRelationship',
  //         id: r.id,
  //       };
  //       rval.push(rdr);
  //       // Now the Hint associated with these must be invalidated.
  //       const kids : StyleObject[] =
  //         this.notebook.findStyles({ role: 'HINT', type: 'HINT-DATA', source: 'ALGEBRAIC-TOOLS', recursive: true });
  //       kids.forEach(k => {
  //         if (k. == r.id) {
  //           const changeReq: StyleDeleteRequest = {
  //             type: 'deleteStyle',
  //             styleId: k.id
  //           };
  //           console.log("deleting: ",k);
  //           rval.push(changeReq);
  //         }
  //       });

  //     });
  //   }
  // }

  private async algebraicToolsStyleInsertRule(style: StyleObject, rval: NotebookChangeRequest[]): Promise<void> {

    if (style.type != 'WOLFRAM' || style.role != 'EVALUATION') { return; }

    // TODO: collect these strings in some way so that
    // if they are duplicates (which happens often), we add only
    // one tool for them.
    await this.addTool(style,rval,
                       "InputForm[Factor[${expr}]]",
                       "factor",
                       (s : string) => `Factor: ${s}`,
                       (s : string) => `\\text{Expand: } ${s}`);
    await this.addTool(style,rval,
                       "InputForm[Expand[${expr}]]",
                       "expand",
                       (s : string) => `Expand: ${s}`,
                       (s : string) => `\\text{Expand: } ${s}`);
    await this.addTool(style,rval,
                       "InputForm[ExpandAll[${expr}]]",
                       "expand all",
                       (s : string) => `ExpandAll: ${s}`,
                       (s : string) => `\\text{ExpandAll: } ${s}`);
    await this.addTool(style,rval,
                       "InputForm[Simplify[${expr}]]",
                       "simplify",
                       (s : string) => `Simplify: ${s}`,
                       (s : string) => `\\text{Simplify: } ${s}`);
    await this.addTool(style,rval,
                       "InputForm[Cancel[${expr}]]",
                       "cancel",
                       (s : string) => `Cancel: ${s}`,
                       (s : string) => `\\text{Cancel: } ${s}`);
    await this.addTool(style,rval,
                       "InputForm[Together[${expr}]]",
                       "together",
                       (s : string) => `Together: ${s}`,
                       (s : string) => `\\text{Together: } ${s}`);
    await this.addTool(style,rval,
                       "InputForm[Apart[${expr}]]",
                       "apart",
                       (s : string) => `Apart: ${s}`,
                       (s : string) => `\\text{Apart: } ${s}`);
  }

  // RLR attempts here to create a change function
  // to be used by the high-level API...
  // @ts-ignore
  private async dependentChangeRule(relationship: RelationshipObject,
                                    inputValues: DataflowValue[]) : Promise<DataflowValue[]> {

    var dfvs: DataflowValue[] = [];
    if (relationship.role != 'TRANSFORMATION') return dfvs;
    // In this case (that of ALGEBRAIC-TOOLS),
    // The outputs are only FORMULA and HINT in that order

    // TODO: When LEGACY is removed, this shall be
    // 0, not 1.
    const changedData = inputValues[0].value;

    var substituted = relationship.data.replace('${expr}', changedData);

    var hdata : HintData = {
      relationship: HintRelationship.Equivalent,
      status: HintStatus.Correct,
      idOfRelationshipDecorated: relationship.id,
    };

    try {
      const transformed = await execute(substituted);

      dfvs.push({
        status: DataflowStatus.Changed,
        message: 'CHANGED',
        value: transformed
      });
      dfvs.push({
        status: DataflowStatus.Changed,
        message: 'CHANGED',
        value: hdata,
      });
    } catch (e) {
      debug("error in wolfram execution: "+substituted);
      console.error("error in wolfram execution: "+substituted);
      dfvs[0] = {
        status: DataflowStatus.Invalid,
        message: 'UNCHANGED',
        value: changedData
      }
      dfvs[1] = {
        status: DataflowStatus.Invalid,
        message: 'UNCHANGED',
        value: hdata,
      }
    }

    return dfvs;
  }
}
