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

import { StyleObject, RelationshipObject,
         StyleId,
         FormulaData
       } from '../../client/notebook';
import { NotebookChangeRequest, StyleInsertRequest,
         StyleChangeRequest,
         StyleMoveRequest,
         StyleDeleteRequest, StylePropertiesWithSubprops
       } from '../../client/math-tablet-api';
import { ServerNotebook }  from '../server-notebook';

import { ensureGlobalLoaded } from './global';
ensureGlobalLoaded();

// Types

interface RelationshipStringObject {
  from: string;
  to: string;
}

// Constants

const data:string[] = [
  "X = 4",
  "X + Y",
  "X = 5",
  "X = 6",
  "Y = X^2"
];

const insertRequest:StyleInsertRequest[] = insertWolframFormulas(data);

// Unit Tests

describe("test symbol observer", function() {
  let notebook: ServerNotebook;

  beforeEach(async function(){
    notebook = await ServerNotebook.createAnonymous();
  });

  afterEach(async function(){
    await notebook.close();
  });

  describe("observer", function(){
    // Note: Doing this for WOLFRAM / INPUT is not really
    // the intended use case for our "exclusivity", but it will serve.
    it("two insert requests, if marked exclusive, only produce one child", async function(){
      const data:string[] = [
        "X = 4"];
      const changeRequests = insertWolframFormulas(data);


      await notebook.requestChange('TEST', changeRequests[0]);

      // This should not rely on an id!!!
      const style = notebook.topLevelStyleOf(1);

      // This is fragile and stupid.
//      assert.deepEqual(style.type,'WOLFRAM-EXPRESSION');

      // Now we want to try to create two child requests,
      // and see that only one is created
      const fake_result = "4";
      const styleProps1: StylePropertiesWithSubprops = {
        type: 'WOLFRAM-EXPRESSION',
        data: <string>fake_result,
        role: 'EVALUATION',
        exclusiveChildTypeAndRole: true,
      }
      const cr1: StyleInsertRequest = {
        type: 'insertStyle',
        parentId: style.id,
        styleProps: styleProps1,
      };

      const styleProps2: StylePropertiesWithSubprops = {
        type: 'WOLFRAM-EXPRESSION',
        data: <string>fake_result,
        role: 'EVALUATION',
        exclusiveChildTypeAndRole: true,
      }
      const cr2: StyleInsertRequest = {
        type: 'insertStyle',
        parentId: style.id,
        styleProps: styleProps2,
      };
      await notebook.requestChanges('TEST', [cr1,cr2]);

      // Now we want to assert that "style" has only one WOLFRAM EVALUATION
      // child.
      // REVIEW: Does this search need to be recursive?
      const childEvaluation = notebook.findStyles({ type: 'WOLFRAM-EXPRESSION', role: 'EVALUATION', recursive: true }, style.id);
      assert(childEvaluation.length == 1,"There should be one evaluation, but there are:"+childEvaluation.length);


      const childRepresentation = notebook.findStyles({ type: 'WOLFRAM-EXPRESSION', role: 'REPRESENTATION', recursive: true }, style.id);
      assert(childRepresentation.length == 1,"There should be one evaluation, but there are:"+childRepresentation.length);



    });

    it("a definition and a use creates a relationship if separate", async function(){

      const changeRequests = [insertRequest[0],insertRequest[1]];
      await notebook.requestChange('TEST', changeRequests[0]);
      await notebook.requestChange('TEST', changeRequests[1]);
      const style = notebook.topLevelStyleOf(1);
      assert.deepEqual(style.type,'FORMULA-DATA');
      assert.equal(notebook.allRelationships().length,1);
      const r : RelationshipObject = notebook.allRelationships()[0];
      const fromObj : StyleObject = notebook.topLevelStyleOf(r.fromId);
      const toObj : StyleObject =  notebook.topLevelStyleOf(r.toId);
      assert.equal(fromObj.data.wolframData,data[0]);
      assert.equal(toObj.data.wolframData,data[1]);
    });
    it("a definition and a use creates a relationship if combined", async function(){
      const changeRequests = [insertRequest[0],insertRequest[1]];

      await serializeChangeRequests(notebook,changeRequests);
//      await notebook.requestChanges('TEST', changeRequests);
      const style = notebook.topLevelStyleOf(1);
      assert.deepEqual(style.type,
                       'FORMULA-DATA'
                      );

      assert.equal(notebook.allRelationships().length,1);
      const r : RelationshipObject = notebook.allRelationships()[0];
      const fromObj : StyleObject = notebook.topLevelStyleOf(r.fromId);
      const toObj : StyleObject =  notebook.topLevelStyleOf(r.toId);

      assert.equal(fromObj.data.wolframData,data[0]);
      assert.equal(toObj.data.wolframData,data[1]);
    });

    it("deleting used doesn't fail", async function(){
      const changeRequests = [insertRequest[0],insertRequest[1]];
      await serializeChangeRequests(notebook,changeRequests);
//      await notebook.requestChanges('TEST', changeRequests);
      const style = notebook.topLevelStyleOf(1);
      assert.deepEqual(style.type,'FORMULA-DATA');

      assert.equal(notebook.allRelationships().length,1);
      const deleteReq : StyleDeleteRequest = { type: 'deleteStyle',
                           styleId: style.id };

      await notebook.requestChange('TEST', deleteReq);
      assert.equal(notebook.allRelationships().length,0);
    });
    it("multiple definitions create inconsistencies",async function(){
      // Our goal here is to mark two defintions as inconsistent,
      // but still keep a linear chain.
      const changeRequests0 = [insertRequest[0],insertRequest[2]];
      const changeRequests1 = [insertRequest[3]];
      await serializeChangeRequests(notebook,changeRequests0);
      // console.log("two exes",notebook);
      // We need a duplication relationship to show up here...
      assert.equal(notebook.allRelationships().length,1);
      // await notebook.requestChanges('TEST', changeRequests0);
      await notebook.requestChanges('TEST', changeRequests1);

      const style = notebook.topLevelStyleOf(1);
      assert.deepEqual(style.type,'FORMULA-DATA');
      assert.equal(notebook.allRelationships().length,2);
      // We want to check that the relaionship is "duplicate def".
      const r : RelationshipObject = notebook.allRelationships()[0];
      assert.equal(r.role,'DUPLICATE-DEFINITION');
    });
    it("two defs and a use create an inconsistency and a use",async function(){
      const changeRequests = [insertRequest[0],insertRequest[2],insertRequest[4]];
      await serializeChangeRequests(notebook,changeRequests);


      assert.equal(2,notebook.allRelationships().length);
      // We want to check that the relaionship is "duplicate def".
      const rds : RelationshipObject[] = notebook.findRelationships({ role: 'DUPLICATE-DEFINITION' });
      assert.equal(1,rds.length);
      const rd = rds[0];
      assert.equal(rd.role,'DUPLICATE-DEFINITION');

      const rus : RelationshipObject[] = notebook.findRelationships({ role: 'SYMBOL-DEPENDENCY' });
      assert.equal(1,rus.length);
      const ru = rus[0];
      assert.equal(ru.role,'SYMBOL-DEPENDENCY');

    });
    it("An input and change does produces only one relationhsip",async function(){
      const data:string[] = [
        "X = 4",
        "X^2 + Y"];
      const changeRequests = insertWolframFormulas(data);

      await serializeChangeRequests(notebook,changeRequests);

      // Now that we have this, the Final one, X^2, should evaulte to 36
      assert.equal(1,notebook.allRelationships().length);

      const rd : RelationshipObject = notebook.allRelationships()[0];
      const fromId = rd.fromId;

      const cr: StyleChangeRequest = {
        type: 'changeStyle',
        styleId: fromId,
        data: { wolframData: "X = 5"},
      };
      await serializeChangeRequests(notebook,[cr]);

      assert.equal(1,notebook.allRelationships().length);

    });
    it("An input and change does produces only one relationhsip",async function(){
      const data:string[] = [
        "X = 4",
        "X^2 + Y"];
      const changeRequests = insertWolframFormulas(data);

      await serializeChangeRequests(notebook,changeRequests);

      // Now that we have this, the Final one, X^2, should evaulte to 36
      assert.equal(1,notebook.allRelationships().length);

      const rd : RelationshipObject = notebook.allRelationships()[0];
      const fromId = rd.fromId;

      const cr: StyleChangeRequest = {
        type: 'changeStyle',
        styleId: fromId,
        data: { wolframData: "X = 5"},
      };
      await serializeChangeRequests(notebook,[cr]);

      assert.equal(1,notebook.allRelationships().length);

    });

    it("Can hanlde 3x - 10 = 11",async function(){
      const data0:string[] = [
        "3x - 10 = 11",
        ];
      const changeRequests = insertWolframFormulas(data0);
      await serializeChangeRequests(notebook,changeRequests);

      // I really want a way to find this from the notebook....
      const initialId = 1;
      // REVIEW: Does this search need to be recursive?
      const children = notebook.findStyles({ type: 'EQUATION-DATA', recursive: true }, initialId);
      assert.equal(1,children.length);
    });


    it("Deleting a use correctly deletes relationships.",async function(){
      const data:string[] = [
        "X = 4",
        "X^2 + Y"];
      const changeRequests = insertWolframFormulas(data);

      await serializeChangeRequests(notebook,changeRequests);

      // Now that we have this, the Final one, X^2, should evaulte to 36
      assert.equal(1,notebook.allRelationships().length);

      const rd : RelationshipObject = notebook.allRelationships()[0];
      const toId = rd.toId;

      const cr: StyleDeleteRequest = {
        type: 'deleteStyle',
        styleId: toId,
      };
      await serializeChangeRequests(notebook,[cr]);
      assert.equal(0,notebook.allRelationships().length);
    });
    it("Relationships can be completely recomputed",async function(){
      const data:string[] = [
        "X = 3",
        "X = 4",
        "X^2"];
      const changeRequests = insertWolframFormulas(data);

      await serializeChangeRequests(notebook,changeRequests);
      const rels = notebook.recomputeAllSymbolRelationships();
      assert.equal(notebook.allRelationships().length,rels.length);
    });

    it("three defs cause the final one to be used",async function(){
      const data:string[] = [
        "X = 4",
        "X = 5",
        "X = 6",
        "Y = X^2"];
      const changeRequests = insertWolframFormulas(data);

      await serializeChangeRequests(notebook,changeRequests);

      // Now that we have this, the Final one, X^2, should evaulte to 36
      assert.equal(3,notebook.allRelationships().length);
      // Now we have want to take the last one, and observe an evaluation.
      // This raises the question: should we add an evaluation to the
      // notebook itself, which would be a bit expensive, but
      // allow us to directly see the evaluation.

      // To try to make this robust, we will specifically construct
      // the value. We also need to be able to get the last thought.
      const lastThoughtId = notebook.topLevelStyleOrder().slice(-1)[0];

      // now that we have the lastThought, we want to get the
      // LATEX type...
      const lastThought = notebook.getStyle(lastThoughtId);

      // REVIEW: Does this search need to be recursive?
      const children = notebook.findStyles({ type: 'TEX-EXPRESSION', recursive: true }, lastThought.id);
      const texformatter = children[0];
      assert.equal('Y = 36',texformatter.data);
      const rels = notebook.recomputeAllSymbolRelationships();
      assert.equal(notebook.allRelationships().length,rels.length);

    });
    it("getSymbolStylesThatDependOnMe works",async function(){
      const data:string[] = [
        "X = 6",
        "Y = X^2"];
      const insertRequests = insertWolframFormulas(data);
      await serializeChangeRequests(notebook,insertRequests);

      const rs = notebook.allRelationships();
      assert.equal(1,rs.length);
      const defStyle = notebook.getStyle(rs[0].fromId);
      const U = notebook.getSymbolStylesThatDependOnMe(defStyle);
      assert.equal(1,U.length);


    });
    it("two defs and a delete cause the final one to be used",async function(){
      const data:string[] = [
        "X = 4",
        "X = 6",
        "Y = X^2"];
      const insertRequests = insertWolframFormulas(data);
      await serializeChangeRequests(notebook,insertRequests);

      const secondThoughtId = notebook.topLevelStyleOrder()[1];
      const deleteRequest : StyleDeleteRequest = { type: 'deleteStyle',
                              styleId: secondThoughtId };

      await serializeChangeRequests(notebook,[deleteRequest]);

      // Now that we have this, the Final one, X^2, should evaulte to 36
      assert.equal(1,notebook.allRelationships().length);
      // Now we have want to take the last one, and observe an evaluation.
      // This raises the question: should we add an evaluation to the
      // notebook itself, which would be a bit expensive, but
      // allow us to directly see the evaluation.

      // To try to make this robust, we will specifically construct
      // the value. We also need to be able to get the last thought.
      const lastThoughtId = notebook.topLevelStyleOrder().slice(-1)[0];

      // now that we have the lastThought, we want to get the
      // LATEX type...
      const lastThought = notebook.getStyle(lastThoughtId);

      // REVIEW: Does this search need to be recursive?
      const texformatter = notebook.findStyle({ type: 'TEX-EXPRESSION', recursive: true}, lastThought.id);
      assert.equal('Y = 16',texformatter!.data);


    });
    it("multiples defs and a deletes are handled",async function(){
      const NUM = 8;
      let data:string[] = [];

      for(var i = 0; i < NUM; i++) {
        data[i] = "X = "+(i+3);
      }
      data.push("Y = X^2");
      const insertRequests = insertWolframFormulas(data);
      await serializeChangeRequests(notebook,insertRequests);


      for(var i = NUM-1; i > 1; i--) {

        let penultimate = getThought(notebook,-2);
        const deleteRequest : StyleDeleteRequest = { type: 'deleteStyle',
                                                     styleId: penultimate };

        await serializeChangeRequests(notebook,[deleteRequest]);

//        console.log("penultimate id",penultimate);
//        console.log("notebook IIIII",i,notebook);

        // Now that we have this, the Final one, X^2, should evaulte to 36
//        assert.equal(NUM-2,notebook.allRelationships().length);
        // Now we have want to take the last one, and observe an evaluation.
        // This raises the question: should we add an evaluation to the
        // notebook itself, which would be a bit expensive, but
        // allow us to directly see the evaluation.

        const lasttex = texformatOfLastThought(notebook);

        assert.equal('Y = '+(i+2)*(i+2),lasttex);
        const rels = notebook.recomputeAllSymbolRelationships();
        assert.equal(notebook.allRelationships().length,rels.length);
      }

      // Now we must delete objects!!!
    });

    it("reorderings are supported in simplest possible case",async function(){
      // REVIEW: Just use a static array.
      let data:string[] = [];
      data.push("X = 3");
      data.push("X = 4");
      data.push("Y = X^2");
      const insertRequests = insertWolframFormulas(data);
      await serializeChangeRequests(notebook,insertRequests);


     let penultimate = getThought(notebook,-2);
      const moveRequest : StyleMoveRequest = { type: 'moveStyle',
                                                 styleId: penultimate,
                                                 afterId: 0
                                               };
      await serializeChangeRequests(notebook,[moveRequest]);
      const rel_r =  notebook.allRelationships();
      const rel_recomp = notebook.recomputeAllSymbolRelationships();

      assert.equal(rel_r.length,
                   rel_recomp.length);
    });

    it("multiple formulae are handled correctly", async function(){

      const data:string[] = [ "X = 3", "A = 4", "X = 5", "Y = X^2", "B = A^2" ];
      const insertRequests = insertWolframFormulas(data);
      await serializeChangeRequests(notebook, insertRequests);
      const rel_r_o =  notebook.allRelationships();
      const rsos = constructMapRelations(notebook, rel_r_o);
      assert.equal(rsos.find( r => r.from == "X = 3")!.to, "X = 5");
    });


    it("reorderings are supported across symbols", async function(){

      const data:string[] = [ "X = 3", "A = 4", "X = 5", "Y = X^2", "B = A^2" ];
      const insertRequests = insertWolframFormulas(data);
      await serializeChangeRequests(notebook, insertRequests);

      // the goal here is to move Y = X^2 to the first position.
      let penultimate = getThought(notebook, -2);
      const moveRequest: StyleMoveRequest = {
        type: 'moveStyle',
        styleId: penultimate,
        afterId: 1
      };

      await serializeChangeRequests(notebook, [moveRequest]);

      const rel_r =  notebook.allRelationships();
      const rel_recomp = notebook.recomputeAllSymbolRelationships();

      assert.equal(rel_r.length, rel_recomp.length);
      const rsos = constructMapRelations(notebook, rel_r);

      assert.equal(rsos.find( r => r.from == "X = 3")!.to, "Y = X^2");
      assert.equal(rsos.find( r => r.from == "A = 4")!.to, "B = A^2");

    });

    it("A change correctly updates all relationships",async function(){
      const data0:string[] = [
        "x = 2",
        "x^2",
        ];
      const data1:string[] = [
        "x = 3",
        ];
      const changeRequests = insertWolframFormulas(data0);
      await serializeChangeRequests(notebook,changeRequests);
      // I really want a way to find this from the notebook....

      const formulas = notebook.findStyles({ type: 'FORMULA-DATA', recursive: true });
      assert.equal(formulas.length,2);

      const first_formula = formulas[0];
      const initialId = first_formula!.id;

      const cr: StyleChangeRequest = {
        type: 'changeStyle',
        styleId: initialId,
        data: { wolframData: data1[0] } ,
      };

      await serializeChangeRequests(notebook,[cr]);

      const rel_r = notebook.allRelationships();

      assert.equal(rel_r.length,1);
    });

    it("A change of an equation produces only one equation, not two",async function(){
       const data0:string[] = [
        "3x - 10 = 11",
        ];
      const data1:string[] = [
        "3x - 10 = 14",
        ];
      const changeRequests = insertWolframFormulas(data0);
      await serializeChangeRequests(notebook,changeRequests);

      const topformula = notebook.findStyle({ type: 'FORMULA-DATA', recursive: true});
      if (!topformula) {
        assert.equal(true,false,"topformula not found");
      }
      const initialId = topformula!.id;
      const cr: StyleChangeRequest = {
        type: 'changeStyle',
        styleId: initialId,
        data: { wolframData:  data1[0]},
      };

      await serializeChangeRequests(notebook,[cr]);


      // Now there should be only ONE EQUATION-DEFINITON attached to the single input!!!
      // REVIEW: Does this search need to be recursive?
      const children = notebook.findStyles({ type: 'EQUATION-DATA', recursive: true }, initialId);
      assert.equal(1,children.length);
    });

    // TODO: Move this to a wolfram-cas.spec.ts file later...
    it.skip("Changing correctly recomputes representation",async function(){
      const data:string[] = [
        "x = 2",
        "x^2",
        "x = 3",
        "x = 4"
        ];

      const changeRequests = insertWolframFormulas([data[0],data[1]]);
      await serializeChangeRequests(notebook,changeRequests);
      // I really want a way to find this from the notebook....
      const initialId = 1;

      const cr0: StyleChangeRequest = {
        type: 'changeStyle',
        styleId: initialId,
        data: data[2],
      };
      await serializeChangeRequests(notebook,[cr0]);

      const cr1: StyleChangeRequest = {
        type: 'changeStyle',
        styleId: initialId,
        data: data[3],
      };
      await serializeChangeRequests(notebook,[cr1]);
      const texformatter = notebook.findStyle({ type: 'TEX-EXPRESSION', recursive: true},
                                              initialId);
      assert.equal('x = 4',texformatter!.data);
    });
  });
});

// Helper Functions

// REVIEW: It seems like we shouldn't have to serialize requests in most instances. Why are we doing this?
// I don't know why this might work....
async function serializeChangeRequests(notebook: ServerNotebook,
  changes: NotebookChangeRequest[]) {
  for(const cr of changes) {
    await notebook.requestChange('TEST', cr);
  }
}

function insertWolframFormulas(wolframDatas :string[]) : StyleInsertRequest[] {
  var reqs : StyleInsertRequest[] = [];
  for(const wolframData of wolframDatas) {
    const data: FormulaData = { wolframData };
    reqs.push({
      type: 'insertStyle',
      styleProps: { role: 'FORMULA', type: 'FORMULA-DATA', data }
    });
  }
  return reqs;
}

function constructMapRelations(notebook: ServerNotebook, rs: RelationshipObject[]): RelationshipStringObject[] {
  return rs.map(r => {
    const frS = notebook.getStyle(r.fromId);
    const frTS = notebook.topLevelStyleOf(frS.id);
    const toS = notebook.getStyle(r.toId);
    const toTS = notebook.topLevelStyleOf(toS.id);
    return { from: frTS.data.wolframData, to: toTS.data.wolframData };
  });
}

function texformatOfLastThought(notebook : ServerNotebook) : string {
  // To try to make this robust, we will specifically construct
  // the value. We also need to be able to get the last thought.
  const lastThoughtId = getThought(notebook,-1);

  // now that we have the lastThought, we want to get the
  // LATEX type...
  const lastThought = notebook.getStyle(lastThoughtId);

  // REVIEW: Does this search need to be recursive?
  const texformatter = notebook.findStyle({ type: 'TEX-EXPRESSION', recursive: true }, lastThought.id);
  return texformatter!.data;
}

// Note: i is allowed to be negative, to use the javascript
// convention of negatives counting from the back of the array.
function getThought(notebook: ServerNotebook, i: number): StyleId {
//  assert(i>=0);
  const tls = notebook.topLevelStyleOrder();
  const idx = (i < 0) ?  (tls.length + i) : i;
  assert(i<tls.length);
  return tls[idx];
}
