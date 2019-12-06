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

// TODO: Incremental changes so we don't redraw the entire SVG on every stroke.

// Requirements

import { $new, $newSvg, Html } from '../dom.js';
import { DrawingData, StyleObject, FindStyleOptions } from '../notebook.js';
import { NotebookView } from '../notebook-view.js';
import { getRenderer } from '../renderers.js';
import { SvgStroke } from '../svg-stroke.js';

import { CellView } from './index.js';
import { assert } from '../common.js';
import { ToolInfo } from '../math-tablet-api.js';

// Types

type PointerId = number;
type PointerMap = Map<PointerId, PointerInfo>;

interface PointerInfo {
  stroke?: SvgStroke;
}

// Class

export class DrawingCellView extends CellView {

  // Public Class Methods

  public static create(notebookView: NotebookView, style: StyleObject): DrawingCellView {
    const instance = new this(notebookView, style);
    instance.render(style);
    return instance;
  }

  // Instance Methods

  public render(style: StyleObject): void {
    this.renderStrokes(style);
    this.renderFormula(style);
    this.renderTools(style);
  }

  // -- PRIVATE --

  // Constructor

  private constructor (notebookView: NotebookView, style: StyleObject) {
    super(notebookView, style, 'drawingCell');

    const $formulaRow = $new<HTMLDivElement>('div', {
      appendTo: this.$elt,
      class: 'formulaRow',
    });
    $new<HTMLDivElement>('div', { class: 'handle', html: `(${style.id})`, appendTo: $formulaRow });
    $new<HTMLDivElement>('div', { class: 'status', html: "&nbsp;", appendTo: $formulaRow });
    this.$formula = $new<HTMLDivElement>('div', { class: 'formula', appendTo: $formulaRow });
    this.$tools = $new<HTMLDivElement>('div', { class: 'tools', appendTo: $formulaRow });

    this.$canvas = $newSvg<SVGSVGElement>('svg', {
      appendTo: this.$elt,
      attrs: </* TYPESCRIPT: */any>style.data.size,
      class: 'canvas',
      id: `svg${style.id}`,
      listeners: {
        pointercancel:  e=>this.onPointerCancel(e),
        pointerdown:    e=>this.onPointerDown(e),
        pointerenter:   e=>this.onPointerEnter(e),
        pointerleave:   e=>this.onPointerLeave(e),
        pointermove:    e=>this.onPointerMove(e),
        pointerout:     e=>this.onPointerOut(e),
        pointerover:    e=>this.onPointerOver(e),
        pointerup:      e=>this.onPointerUp(e),
      }
    });

    this.pointerMap = new Map();
  }

  // Private Instance Properties

  private $canvas: SVGSVGElement;
  private $formula: HTMLDivElement;
  private $tools: HTMLDivElement;
  private pointerMap: PointerMap;

  // Private Instance Property Methods

  private pointerInfo(event: PointerEvent): PointerInfo {
    let rval = this.pointerMap.get(event.pointerId);
    if (!rval) {
      rval = {};
      this.pointerMap.set(event.pointerId, rval);
    }
    return rval;
  }

  // Private Instance Methods

  private renderStrokes(style: StyleObject): void {
    this.$canvas.innerHTML = '';
    const data: DrawingData = style.data;
    for (const strokeData of data.strokes) {
      SvgStroke.create(this.$canvas, strokeData);
    }
  }

  private renderFormula(style: StyleObject): void {
    const latexStyle = this.notebookView.openNotebook.findStyle({ meaning: 'INPUT-ALT', type: 'LATEX' }, style.id);
    if (latexStyle) {
      console.log("Rendering drawing cell with LaTeX substyle.");
      const renderer = getRenderer('LATEX');
      const { html, errorHtml } = renderer(latexStyle.data);
      if (html) { this.$formula.innerHTML = html; }
      assert(!errorHtml);
    } else {
      console.log("Rendering drawing cell without LaTeX substyle.");
    }
  }

  // TODO: Duplicated from formula-cell
  private renderTools(style:StyleObject): void {
    this.$tools.innerHTML = '';
    // REVIEW: If we attached tool styles to the top-level style,
    //         then we would not need to do a recursive search.
    const findOptions2: FindStyleOptions = { type: 'TOOL', recursive: true };
    const toolStyles = this.notebookView.openNotebook.findStyles(findOptions2, style.id);
    for (const toolStyle of toolStyles) {
      const toolInfo: ToolInfo = toolStyle.data;
      let html: Html;
      if (toolInfo.tex) {
        const latexRenderer = getRenderer('LATEX');
        const results = latexRenderer!(toolInfo.tex);
        if (results.html) { html = results.html; }
        else { html = results.errorHtml!; }
      } else {
        html = toolInfo.html!;
      }
      const $button = $new('button', {
        class: 'tool',
        html,
        listeners: { 'click': _e=>this.notebookView.useTool(toolStyle.id) }
      });
      this.$tools.appendChild($button);
    }
  }

  // Private Event Handlers

  private onPointerCancel(_event: PointerEvent): void {
    // console.log(`${event.pointerType} ${event.pointerId} ${event.type}`);
    // console.dir(event);
  }

  private onPointerDown(event: PointerEvent): void {
    // console.log(`${event.pointerType} ${event.pointerId} ${event.type}`);
    // console.dir(event);
    this.$canvas.setPointerCapture(event.pointerId);
    const pi = this.pointerInfo(event);

    if (pi.stroke) {
      console.error(`Pointer ${event.pointerId} already has a stroke. Discarding.`);
      pi.stroke.abort();
      delete pi.stroke;
    }
    const clientRect = this.$canvas.getBoundingClientRect();
    pi.stroke = SvgStroke.create(this.$canvas);
    pi.stroke.start(event, clientRect);
  }

  private onPointerEnter(_event: PointerEvent): void {
    // console.log(`${event.pointerType} ${event.pointerId} ${event.type}`);
    // console.dir(event);
  }

  private onPointerLeave(_event: PointerEvent): void {
    // console.log(`${event.pointerType} ${event.pointerId} ${event.type}`);
    // console.dir(event);
  }

  private onPointerMove(event: PointerEvent): void {
    // console.dir(event);
    const pi = this.pointerInfo(event);
    if (pi.stroke) {
      const clientRect = this.$canvas.getBoundingClientRect();
      pi.stroke.extend(event, clientRect);
    }
  }

  private onPointerOut(_event: PointerEvent): void {
    // console.log(`${event.pointerType} ${event.pointerId} ${event.type}`);
    // console.dir(event);
  }

  private onPointerOver(_event: PointerEvent): void {
    // console.log(`${event.pointerType} ${event.pointerId} ${event.type}`);
    // console.dir(event);
  }

  private onPointerUp(event: PointerEvent): void {
    // console.log(`${event.pointerType} ${event.pointerId} ${event.type}`);
    // console.dir(event);
    const pi = this.pointerInfo(event);
    const stroke = pi.stroke;
    if (!stroke) {
      console.warn(`Pointer ${event.pointerId} doesn't have a stroke. Ignoring.`);
      return;
    }
    const clientRect = this.$canvas.getBoundingClientRect();
    stroke.end(event, clientRect);
    delete pi.stroke;

    const data: DrawingData = this.notebookView.openNotebook.getStyleById(this.styleId).data;
    data.strokes.push(stroke.data); // REVIEW: Modifying existing data in place???

    this.notebookView.changeStyle(this.styleId, data)
    .catch(err=>{
      // TODO: Display error to user?
      console.error(`Error submitting stroke: ${err.message}`);
    });
  }

}

