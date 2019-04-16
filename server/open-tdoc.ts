
import * as WebSocket from 'ws';

// TODO: Handle websocket lifecycle: closing, unexpected disconnects, errors, etc.

import { ClientMessage, UserName, NotebookName, ServerMessage } from '../client/math-tablet-api';

import { mathJsCas, parseMathJsExpression, ParseResults } from './mathjs-cas';
import { mathStepsCas } from './math-steps-cas';

import { Style, TDoc, Thought } from './tdoc';
import { readNotebook, writeNotebook } from './users-and-files';

// Types

export interface Cas {
  onTDocOpened(tDoc: TDoc): Promise<void>;
  onThoughtInserted(tDoc: TDoc, thought: Thought): Promise<void>;
  onStyleInserted(tDoc: TDoc, style: Style): Promise<void>;
}

// Class

export class OpenTDoc {

  // Class Methods

  static async connect(userName: UserName, notebookName: NotebookName, ws: WebSocket): Promise<OpenTDoc> {
    const key = `${userName}/${notebookName}`;
    let rval = this.openTDocs.get(key);
    if (!rval) {
      // REVIEW: What if messages come in while we are reading the notebook?
      // TODO: Gracefully handle error if readNotebook throws error. (e.g. invalid version)
      const tDoc = await readNotebook(userName, notebookName);
      await mathJsCas.onTDocOpened(tDoc);
      await mathStepsCas.onTDocOpened(tDoc);
      rval = new this(userName, notebookName, tDoc);
      this.openTDocs.set(key, rval);
    }
    rval.addSocket(ws);
    return rval;
  }

  // Instance Properties

  userName: UserName;
  notebookName: NotebookName;
  tDoc: TDoc;

  // PRIVATE

  // Private Class Properties

  private static openTDocs: Map<string, OpenTDoc> = new Map<string, OpenTDoc>();

  // Private Constructor
  constructor(userName: UserName, notebookName: NotebookName, tDoc: TDoc) {
    this.notebookName = notebookName;
    this.tDoc = tDoc;
    this.userName = userName;
    this.webSockets = new Set<WebSocket>();

    tDoc.on('styleInserted', s=>this.onStyleInserted(s));
    tDoc.on('thoughtInserted', t=>this.onThoughtInserted(t));
  }

  // Private Instance Properties
  webSockets: Set<WebSocket>;

  // Private Event Handlers

  // ENHANCEMENT:
  //     const newStyles = tdoc.applyRules([mathSimplifyRule, mathExtractVariablesRule, mathEvaluateRule]).map(s=>s.toObject());

  private async onMessage(_ws: WebSocket, message: string) {
    try {
      const msg: ClientMessage = JSON.parse(message);
      console.log(`Received socket message: ${msg.action}`);
      // console.dir(msg);
      switch(msg.action) {
      case 'insertHandwrittenMath': {
        const thought = this.tDoc.insertThought();
        this.tDoc.insertLatexStyle(thought, msg.latexMath, 'INPUT', 'USER');
        this.tDoc.insertJiixStyle(thought, msg.jiix, 'HANDWRITING', 'USER');
        this.save();
        break;
      }
      case 'insertHandwrittenText': {
        const thought = this.tDoc.insertThought();
        this.tDoc.insertTextStyle(thought, msg.text, 'INPUT', 'USER');
        this.tDoc.insertStrokeStyle(thought, msg.strokeGroups, 'HANDWRITING', 'USER');
        // TODO: enhance
        this.save();
        break;
      }
      case 'insertMathJsText': {
        let parseResults: ParseResults|undefined = undefined;
        try {
          parseResults = parseMathJsExpression(msg.mathJsText);
        } catch(err) {
          console.error(`insertMathJsText parse error: ${err.message}`);
          break;
        }
        const thought = this.tDoc.insertThought();
        const style = this.tDoc.insertMathJsStyle(thought, parseResults.mathJsText, 'INPUT', 'USER');
        this.tDoc.insertLatexStyle(style, parseResults.latexMath, 'PRETTY', 'USER');
        this.save();
        break;
      }
      default:
        console.error(`Unexpected WebSocket message action ${(<any>msg).action}. Ignoring.`);
        break;
      }
    } catch(err) {
      console.error("Unexpected error handling web-socket message event.");
    }
  }

  private async onStyleInserted(style: Style): Promise<void> {
    this.sendMessage({ action: 'insertStyle', style });
    await mathJsCas.onStyleInserted(this.tDoc, style);
    await mathStepsCas.onStyleInserted(this.tDoc, style);
  }

  private async onThoughtInserted(thought: Thought): Promise<void> {
    this.sendMessage({ action: 'insertThought', thought });
    await mathJsCas.onThoughtInserted(this.tDoc, thought);
    await mathStepsCas.onThoughtInserted(this.tDoc, thought);
  }

  // Private Instance Methods

  private addSocket(ws: WebSocket): void {
    this.webSockets.add(ws);
    ws.on('message', (message: string) => this.onMessage(ws, message));
    this.sendRefresh(ws);
  }

  // LATER: We need something more efficient that saving the whole notebook every time there is a change.
  //        Instead we should just write deltas on to the end of a file or something.
  private async save(): Promise<void> {
    await writeNotebook(this.userName, this.notebookName, this.tDoc);
  }

  private sendRefresh(ws?: WebSocket): void {
    const msg: ServerMessage = { action: 'refreshNotebook', tDoc: this.tDoc.toObject() };
    this.sendMessage(msg, ws);
  }

  private sendMessage(msg: ServerMessage, ws?: WebSocket): void {
    const json = JSON.stringify(msg);
    if (ws) { ws.send(json); }
    else {
      for (const ws of this.webSockets) {
        ws.send(json);
      }
    }
  }
}
