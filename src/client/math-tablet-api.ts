

export type NotebookName = string;
export type StyleType =
  // TYPE   // DATA
  'JIIX'|   // MyScript JIIX export from 'MATH' editor.
  'MATH'|   // LaTeX string
  'MATHJS'| // Math JS Node Tree
  'MATHJSSIMPLIFICATION'|
  'STROKE'| // MyScript strokeGroups export from 'TEXT' editor.
  'TEXT'|   // Plain text
  'SYMBOL'; // LaTeX string
export type UserName = string;

// Plain object version of TDoc

export interface StyleObject {
  id: number;
  stylableId: number;
  type: StyleType;
  data: any;
}

export interface TDocObject {
  nextId: number;
  version: string;
  thoughts: ThoughtObject[];
  styles: StyleObject[];
}

export interface ThoughtObject {
  id: number;
}

// API Calls

export interface EnhanceParams {
  tDoc: TDocObject;
}

export interface EnhanceResults {
  ok: true;
  newStyles: StyleObject[];
}

export interface OpenParams {
  userName: UserName;
  notebookName: NotebookName;
}

export interface OpenResults {
  ok: true,
  tDoc: TDocObject,
}

export interface SaveParams {
  userName: UserName;
  notebookName: NotebookName;
  tDoc: TDocObject;
}

export interface SaveResults {
  ok: true;
}
