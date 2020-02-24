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

// import * as debug1 from 'debug';
// const MODULE = __filename.split(/[/\\]/).slice(-1)[0].slice(0,-3);
// const debug = debug1(`server:${MODULE}`);
import { assert } from 'chai';
import 'mocha';
// import * as sinon from 'sinon';

import { NotebookChange,  StyleObject, RelationshipObject,
         StyleId
       } from '../../client/notebook';
import { NotebookChangeRequest, StyleInsertRequest,
         //         StyleChangeRequest,
         //         StyleMoveRequest,
         //         StyleDeleteRequest,
         //        StylePropertiesWithSubprops
       } from '../../client/math-tablet-api';
import { ServerNotebook, ObserverInstance }  from '../server-notebook';

import { SymbolClassifierObserver } from '../observers/symbol-classifier';
// import { EquationSolverObserver } from '../observers/equation-solver';
import { MathematicaObserver } from '../observers/mathematica-cas';
import { AlgebraicToolsObserver } from '../observers/algebraic-tools';
// import { TeXFormatterObserver } from '../observers/tex-formatter';
import { AnyInputObserver } from '../observers/any-input';
import { WolframObserver } from '../observers/wolfram-cas';
import { start as startWolframscript } from '../wolframscript';
import { Config, loadConfig } from '../config';

// Test Observer

export class TestObserver implements ObserverInstance {
  static async initialize(_config: Config): Promise<void> { }
  static async onOpen(_notebook: ServerNotebook): Promise<TestObserver> { return new this(); }
  constructor() {}
  async onChangesAsync(_changes: NotebookChange[]): Promise<NotebookChangeRequest[]> { return []; }
  public onChangesSync(_changes: NotebookChange[]): NotebookChangeRequest[] { return []; }
  async onClose(): Promise<void> {}
  async useTool(_style: StyleObject): Promise<NotebookChangeRequest[]> { return []; }
}

// Unit Tests
// This is likely to be needed, so I am retaining at the early stage of writing this file -rlr
// @ts-ignore
async function serializeChangeRequests(notebook: ServerNotebook,
                                 changes: NotebookChangeRequest[]) {
  for(const cr of changes) {
      await notebook.requestChanges('TEST', [cr]);
  }
}

function generateInsertRequests(inputs :string[]) : StyleInsertRequest[] {
  var reqs : StyleInsertRequest[] = [];
  for(const i of inputs) {
    reqs.push( { type: 'insertStyle',
            styleProps: { role: 'REPRESENTATION', type: 'WOLFRAM', data: i } }
        );
  }
  return reqs;
}

interface RelationshipStringObject {
  from: string;
  to: string;
}

// This is likely to be needed, so I am retaining at the early stage of writing this file -rlr
// @ts-ignore
function constructMapRelations(notebook: ServerNotebook,
                               rs : RelationshipObject[]) :RelationshipStringObject[] {
  return rs.map(r => {
    const frS = notebook.getStyle(r.fromId);
    const frTS = notebook.topLevelStyleOf(frS.id);
    const toS = notebook.getStyle(r.toId);
    const toTS = notebook.topLevelStyleOf(toS.id);
    return { from: frTS.data, to: toTS.data};
  });
}

// This is likely to be needed, so I am retaining at the early stage of writing this file -rlr
// @ts-ignore
function getThought(notebook : ServerNotebook,n : number) : StyleId {
  const tls = notebook.topLevelStyleOrder();
  const thoughtId = tls.slice(n)[0];
  return thoughtId;
}

// This is likely to be needed, so I am retaining at the early stage of writing this file -rlr
// @ts-ignore
//const insertRequest:StyleInsertRequest[] = generateInsertRequests(data);


describe("test relationships", function() {
  let notebook: ServerNotebook;


  before("correctly configure stuff", async function(){
    // We can't do this test if we don't have mathematica
    const config = await loadConfig();

    // TODO: stopWolframscript before exiting.
    if (config.mathematica) { await startWolframscript(config.wolframscript); }

    if (config.mathematica) {
      await MathematicaObserver.initialize(config);
    } else {
    }



  });


  beforeEach("Reinitialize notebook",async function(){
    // Create a notebook
    notebook = await ServerNotebook.createAnonymous();

    // Register the observer
    const testObserver = await TestObserver.onOpen(notebook);
    const symbolClassifierObserver = await SymbolClassifierObserver.onOpen(notebook);
    const mathematicaObserver = await MathematicaObserver.onOpen(notebook);
//    const equationSolverObserver = await EquationSolverObserver.onOpen(notebook);
//    const teXFormatterObserver = await TeXFormatterObserver.onOpen(notebook);
    const anyInputObserver = await AnyInputObserver.onOpen(notebook);
    const wolframObserver = await WolframObserver.onOpen(notebook);
    const algebraicToolsObserver = await AlgebraicToolsObserver.onOpen(notebook);

    notebook.registerObserver('TEST', testObserver);
    notebook.registerObserver('SYMBOL-CLASSIFIER', symbolClassifierObserver);
    notebook.registerObserver('MATHEMATICA', mathematicaObserver);
//    notebook.registerObserver('EQUATION-SOLVER', equationSolverObserver);
    //    notebook.registerObserver('TEX-FORMATTER', teXFormatterObserver);
    notebook.registerObserver('ALGEBRAIC-TOOLS', algebraicToolsObserver);
    notebook.registerObserver('ANY-INPUT', anyInputObserver);
    notebook.registerObserver('WOLFRAM', wolframObserver);

  });
  afterEach("Close notebook",async function(){
    // Close the notebook.
    await notebook.close();
  });

  after("onClose is called when notebook is closed", async function(){

  });


  describe("relationships support changes", function(){

    // This is the first unit test of a new understanding of N-ary relationships.
    // The basic approach is to:
    // Create a forumla F1
    // Use a transformation tool on it
    // This creates F2, a relationship and a HINT
    // Use the inverse relationship (e.g., apart is the inverse of together) to create F3
    // This creates F3, an additional HINT, and a second relationship

    // This structure can be used as the basis of several tests:
    // Can we change F1 and see that F3 changes (if inverse relationships are used, should be F3 == F1)?
    // Can we make a change to F1 that makes the tool inapplicable ( x^2 + x => 4) and see
    // that the forumalae and hints are correctly marked as changed.

    it("Can derive formulae then propagate a change", async function(){
      const data:string[] = [
        "x + x^2"];
      const changeRequests = generateInsertRequests(data);
      await notebook.requestChanges('TEST', [changeRequests[0]]);
      const F1 = notebook.topLevelStyleOf(1);
      assert.deepEqual(F1.type,'WOLFRAM');

      const F1_wolfram = notebook.findStyle({ type: 'WOLFRAM', recursive: true }, F1.id);

      assert.isNotNull(F1_wolfram);


      const F1_algebra_tools = notebook.findStyles({ type: 'TOOL', source: 'ALGEBRAIC-TOOLS', recursive: true }, F1_wolfram!.id);
      // There will be several tools, we select the one whose "name" is "factor"
      const F1_factor_tool = F1_algebra_tools.find( e => e.data.name == "factor");


      // Now we wish to "apply" this transform as if it were "used" in the GUI...
      // I'm suspecting the high-level API for this could be improved...
      var ncrs1 = await notebook.useTool(F1_factor_tool!.id);
//      await notebook.requestChanges('TEST', ncrs1);
      console.log(ncrs1);
      console.log(notebook);

      const Wolframs = notebook.findStyles({ type: 'WOLFRAM', role: 'EVALUATION', recursive: true });

      assert.equal(Wolframs.length,2);
      const F2_wolfram = Wolframs.find(w => w.id != F1.id );

      const F2_algebra_tools = notebook.findStyles({ type: 'TOOL', source: 'ALGEBRAIC-TOOLS', recursive: true }, F2_wolfram!.id);
      // There will be several tools, we select the one whose "name" is "factor"
      console.log(F2_algebra_tools);
      const F2_simplify_tool = F2_algebra_tools.find( e => e.data.name == "simplify");

      var ncrs2 = await notebook.useTool(F2_simplify_tool!.id);
//      await notebook.requestChanges('TEST', ncrs2);
      console.log(ncrs2);
      console.log(notebook);

    });
  });
});