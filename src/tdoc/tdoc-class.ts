// LICENSE TBD
// Copyright 2019, Robert L. Read & David Jeschke

// Requirement

import { StyleObject, StyleMeaning, StyleType, TDocObject, ThoughtObject } from '../client/math-tablet-api';

// Types

type LaTeXString = string;
type MathJsExpression = object;
type MathJsPlain = string;
type StrokeData = string;
type Stylable = Thought|Style;
type StylableId = number;
type StyleRule = (tdoc: TDoc, style: Style)=>Style[];
type TextData = string;
type JiixData = string;

// Constants

const VERSION = "0.0.1";

export class TDoc {

  // Public Class Methods

  public static create(): TDoc {
    return new this();
  }

  public static fromJsonObject(obj: TDocObject): TDoc {
    // Validate the object
    if (!obj.nextId) { throw new Error("Invalid TDoc object JSON."); }
    if (obj.version != VERSION) { throw new Error("TDoc in unexpected version."); }

    // Reanimate the thoughts and styles
    const thoughts: Thought[] = obj.thoughts.map(Thought.fromJsonObject);
    const styles: Style[] = obj.styles.map(Style.fromJsonObject);

    // Create the TDoc object from its properties and reanimated thoughts and styles.
    const tDoc = Object.assign(Object.create(TDoc.prototype), { ...obj, styles, thoughts });

    // WARNING: This was not David's original code---I don't know if this is correct or not.
    // TODO: nextId should be restored from the JSON object. Doubt this is the correct fix.
    tDoc.nextId = (tDoc.getStyles().length + tDoc.getThoughts().length) + 1;
    return tDoc;
  }

  // Public Instance Properties

  public version: string;

  public nextId: StylableId;

  // To be used for providing dynamic TDoc scope. Any client may
  // attach data to this object, which is considered volatile (not part
  // of permanent state.
  public clientData: any;

  // Public Instance Methods

  // Applies each rule to each style of the TDoc
  // and returns an array of any new styles that were generated.
  public applyRules(rules: StyleRule[]): Style[] {
    let rval: Style[] = [];
    // IMPORTANT: The rules may add new styles. So capture the current
    //            length of the styles array, and only iterate over
    //            the existing styles. Otherwise, we could get into
    //            an infinite loop.
    const len = this.styles.length;
    for (let i=0; i<len; i++) {
      const style = this.styles[i];
      for (const rule of rules) {
        const newStyles = rule(this, style);
        rval = rval.concat(newStyles);
      }
    }
    return rval;
  }

  // This can be asymptotically improved later.
  public stylableHasChildOfType(style: Style, tname: string, meaning?: StyleMeaning): boolean {
    const id = style.id;
    return this.styles.reduce(
      function(hasOne,x){
        return hasOne ||
          ((x.stylableId == id) &&
           (x.type == tname) &&
           (!meaning || x.meaning == meaning)
          );
          },
      false);
  }

  public createJiixStyle(stylable: Stylable, data: JiixData, meaning?: StyleMeaning): JiixStyle {
    return this.addStyle(new JiixStyle(this.nextId++, stylable, data, meaning));
  }

  public createLatexStyle(stylable: Stylable, data: LaTeXString, meaning?: StyleMeaning): LatexStyle {
    return this.addStyle(new LatexStyle(this.nextId++, stylable, data, meaning));
  }

  public createMathJsStyle(stylable: Stylable, data: MathJsExpression, meaning?: StyleMeaning): MathJsStyle {
    return this.addStyle(new MathJsStyle(this.nextId++, stylable, data, meaning));
  }

  public createMathJsPlainStyle(stylable: Stylable, data: MathJsPlain, meaning?: StyleMeaning): MathJsPlainStyle {
    return this.addStyle(new MathJsPlainStyle(this.nextId++, stylable, data, meaning));
  }

  public createMathJsSimplificationStyle(stylable: Stylable, data: MathJsExpression, meaning?: StyleMeaning): MathJsSimplificationStyle {
    return this.addStyle(new MathJsSimplificationStyle(this.nextId++, stylable, data, meaning));
  }

  // REVIEW: Is this used?
  public createSymbolStyle(stylable: Stylable, data: LaTeXString, meaning?: StyleMeaning): SymbolStyle {
    return this.addStyle(new SymbolStyle(this.nextId++, stylable, data, meaning));
  }

  public createStrokeStyle(stylable: Stylable, data: StrokeData, meaning?: StyleMeaning): StrokeStyle {
    return this.addStyle(new StrokeStyle(this.nextId++, stylable, data, meaning));
  }

  public createTextStyle(stylable: Stylable, data: TextData, meaning?: StyleMeaning): TextStyle {
    return this.addStyle(new TextStyle(this.nextId++, stylable, data, meaning));
  }

  public createThought(): Thought {
    const rval = new Thought(this.nextId++);
    this.thoughts.push(rval);
    return rval;
  }


  // ENUMERATION AND INTERROGATION
  // We need a way to interrogate a TDoc. There are lots of
  // approaches here; I expect this to be constantly evolving.
  // In particular, dej has suggested accessing styles via
  // the thoughts they annotate; this seems like a good idea. -rlr
  public getThoughts(): Thought[] {
    return this.thoughts;
  }

  public getStyles(): Style[] {
    return this.styles;
  }

  public jsonPrinter(): string {
    return JSON.stringify(this,null,' ');
  }


  public numStyles(tname: string) : number {
    return this.styles.reduce(
      function(total,x){
        return (x.type == tname)
          ?
          total+1 : total},
      0);
  }

  public summaryPrinter(): string {
    var numMath = this.numStyles("MATH");
    var numText = this.numStyles("TEXT");
    return `${this.thoughts.length} thoughts\n`
      + `${this.styles.length} styles\n`
      + `${numMath} math styles\n`
      + `${numText} text styles\n`
    ;
  }

  public toObject(): TDocObject {
    // TYPESCRIPT: We are counting on the fact that a StyleObject that has
    // been stringified and then parsed is a StyleObject.
    return <any>this;
  }

  // COMPILERS

    // take a set of comma-separated-values and
  // produce a tdoc full of thoughts; this is
  // useful mostly for testing.
  public addFromText(type: string,text: string): TDoc {
    let ths = text.split(",");
    // @ts-ignore
    let styleType = STYLE_CLASSES[type];
    ths.forEach(text => {
      let th = this.createThought();

      // TODO: I believe there should be a more elegant way to do this.
      let newst =
          Object.create(styleType.prototype);
      newst.type = type;
      newst.data = text;
      newst.meaning = "CREATED";
      newst.stylableId = th.id;
      newst.id = this.nextId++;
      return this.addStyle(newst);
    });
    return this;
  }

  // --- PRIVATE ---

  // Private Constructor

  private constructor() {
    this.nextId = 1;
    this.styles = [];
    this.thoughts = [];
    this.version = VERSION;
    this.clientData = [];
  }

  // Private Instance Properties

  private styles: Style[];
  private thoughts: Thought[];

  // Private Instance Methods

  // Helper method for tDoc.create*Style.
  private addStyle<T extends Style>(style: T): T {
    this.styles.push(style);
    return style;
  }

}

export class Thought {

  public static fromJsonObject(obj: ThoughtObject): Thought {
    // NOTE: This will throw for id === 0.
    if (!obj.id) { throw new Error("Invalid Thought object JSON"); }
    return Object.assign(Object.create(Thought.prototype), obj);
  }

  // Call tDoc.createThought instead of calling this constructor directly.
  /* private */ constructor(id: StylableId) {
    this.id = id;
  }

  // Public Instance Properties
  public id: StylableId;
}

export abstract class Style {

  public static fromJsonObject(obj: StyleObject): Style {
    if (!obj.type) { throw new Error("Invalid Style object JSON"); }
    // @ts-ignore // TYPESCRIPT:
    const cl = STYLE_CLASSES[obj.type];
    if (!cl) { throw new Error(`Style class not found in STYLE_CLASSES: ${obj.type}`); }
    return Object.assign(Object.create(cl.prototype), obj);
  }

  constructor(id: StylableId, stylable: Stylable) {
    this.id = id;
    this.stylableId = stylable.id;
  }

  // Instance Properties
  public id: number;
  public stylableId: number;
  public abstract type: StyleType;
  public abstract data: any;
  public abstract meaning?: StyleMeaning;

  // Instance Methods

  public toObject(): StyleObject {
    // TYPESCRIPT: We are counting on the fact that a StyleObject that has
    // been stringified and then parsed is a StyleObject.
    return <any>this;
  }
}

class JiixStyle extends Style {
  // Call tDoc.createJiixStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: JiixData, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'JIIX';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'JIIX';
  data: JiixData;
  meaning?: StyleMeaning;
}

export class LatexStyle extends Style {
  // Call tDoc.createLatexStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: LaTeXString, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'LATEX';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'LATEX';
  data: LaTeXString;
  meaning?: StyleMeaning;
}

export class MathJsStyle extends Style {
  // Call tDoc.createMathJsStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: MathJsExpression, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'MATHJS';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'MATHJS';
  data: MathJsExpression;
  meaning?: StyleMeaning;
}

export class MathJsPlainStyle extends Style {
  // Call tDoc.createMathJsPlainStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: MathJsPlain, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'MATHJS-PLAIN';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'MATHJS-PLAIN';
  data: MathJsPlain;
  meaning?: StyleMeaning;
}

export class MathJsSimplificationStyle extends Style {
  // Call tDoc.createMathJsSimplificationStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: MathJsExpression, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'MATHJSSIMPLIFICATION';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'MATHJSSIMPLIFICATION';
  data: MathJsExpression;
  meaning?: StyleMeaning;
}

export class SymbolStyle extends Style {
  // Call tDoc.createSymbolStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: LaTeXString, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'SYMBOL';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'SYMBOL';
  data: LaTeXString;
  meaning?: StyleMeaning;
}

class StrokeStyle extends Style {
  // Call tDoc.createStrokeStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: StrokeData, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'STROKE';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'STROKE';
  data: StrokeData;
  meaning?: StyleMeaning;
}

class TextStyle extends Style {
  // Call tDoc.createTextStyle instead of calling this constructor directly.
  /* private */ constructor(id: StylableId, stylable: Stylable, data: TextData, meaning?: StyleMeaning) {
    super(id, stylable);
    this.type = 'TEXT';
    this.data = data;
    this.meaning = meaning;
  }

  // Instance Properties
  type: 'TEXT';
  data: TextData;
  meaning?: StyleMeaning;
}

const STYLE_CLASSES /* : { [type: string]: } */ = {
  'JIIX': JiixStyle,
  'LATEX': LatexStyle,
  'MATHJS': MathJsStyle,
  'MATHJS-PLAIN': MathJsPlainStyle,
  'MATHJSSIMPLIFICATION': MathJsSimplificationStyle,
  'STROKE': StrokeStyle,
  'TEXT': TextStyle,
  'SYMBOL': SymbolStyle
}
