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
// const debug = debug1(`tests:${MODULE}`);
import { assert } from 'chai';
import 'mocha';
// import * as sinon from 'sinon';

import { RelationshipObject,
         StyleId,
         FormulaData
       } from '../../client/notebook';
import { NotebookChangeRequest, StyleInsertRequest,
         StyleChangeRequest,
         WolframData,
         //         StyleMoveRequest,
         //         StyleDeleteRequest,
         //        StylePropertiesWithSubprops
       } from '../../client/math-tablet-api';
import { ServerNotebook }  from '../server-notebook';

import { ensureGlobalLoaded } from './global';
ensureGlobalLoaded();

// Unit Tests

describe("test relationships", function() {
  let notebook: ServerNotebook;

  beforeEach(async function(){
    notebook = await ServerNotebook.createAnonymous();
  });

  afterEach(async function(){
    await notebook.close();
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
      const data:string[] = [ "x + x^2", "2*x + 2*x^2"];
      const changeRequests = generateInsertRequests(data);
      await notebook.requestChanges('TEST', [changeRequests[0]]);
      const F1 = notebook.topLevelStyleOf(1);
      assert.deepEqual(F1.type,'WOLFRAM');

      const F1_wolfram = notebook.findStyle({ type: 'WOLFRAM', role: 'EVALUATION', recursive: true }, F1.id);

      assert.isNotNull(F1_wolfram);


      const F1_algebra_tools = notebook.findStyles({ type: 'TOOL', source: 'ALGEBRAIC-TOOLS', recursive: true }, F1_wolfram!.id);
      // There will be several tools, we select the one whose "name" is "factor"
      const F1_factor_tool = F1_algebra_tools.find( e => e.data.name == "factor");


      // Now we wish to "apply" this transform as if it were "used" in the GUI...
      // I'm suspecting the high-level API for this could be improved...
      await notebook.useTool(F1_factor_tool!.id);

      var Wolframs = notebook.findStyles({ type: 'WOLFRAM', role: 'EVALUATION', recursive: true });

      assert.equal(Wolframs.length,2);
      const F2_wolfram = Wolframs.find(w => w.id != F1.id );

      const F2_algebra_tools = notebook.findStyles({ type: 'TOOL', source: 'ALGEBRAIC-TOOLS', recursive: true }, F2_wolfram!.id);
      // There will be several tools, we select the one whose "name" is "factor"
      const F2_simplify_tool = F2_algebra_tools.find( e => e.data.name == "simplify");

      await notebook.useTool(F2_simplify_tool!.id);

      // Now, having accomplished this, we wish to change F1 and observe
      // that that change propagatest to F3.
      Wolframs = notebook.findStyles({ type: 'WOLFRAM', role: 'EVALUATION', recursive: true });
      const F3_wolfram = Wolframs.find(w => (w.id != F1.id && w.id != F2_wolfram!.id));


      // Now we will change something... and compare
      // F1 to F3
      const cr: StyleChangeRequest = {
        type: 'changeStyle',
        styleId: F1_wolfram!.id,
        data: data[1]
      };
      await serializeChangeRequests(notebook,[cr]);

      // First we will check that we have affected F2, then F3...
      // This is a bit fragile and wolfram specific...
      assert.equal("2*x + 2*x^2",F2_wolfram!.data);
      assert.equal("2*x*(1 + x)",F3_wolfram!.data);

    });
  });
});

// Helper Functions

// This is likely to be needed, so I am retaining at the early stage of writing this file -rlr
// @ts-ignore
async function serializeChangeRequests(notebook: ServerNotebook,
  changes: NotebookChangeRequest[]) {
for(const cr of changes) {
await notebook.requestChanges('TEST', [cr]);
}
}

function generateInsertRequests(inputs: WolframData[]): StyleInsertRequest[] {
return inputs.map(wolframData=>{
const data: FormulaData = { wolframData };
const request: StyleInsertRequest = {
type: 'insertStyle',
styleProps: { role: 'REPRESENTATION', type: 'WOLFRAM', data },
};
return request;
});
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
