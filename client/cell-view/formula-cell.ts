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

import { $new, escapeHtml, Html } from '../dom.js';
import { ToolData } from '../math-tablet-api.js';
import { StyleObject, FindRelationshipOptions, FindStyleOptions } from '../notebook.js';
import { NotebookView } from '../notebook-view.js';
import { getRenderer } from '../renderers.js';
import { FORMULA_SUBROLE_PREFIX } from '../role-selectors.js';

import { CellView } from './index.js';

// Types

// Constants

// Class

export class FormulaCellView extends CellView {

  // Class Methods

  public static create(notebookView: NotebookView, style: StyleObject): FormulaCellView {
    const instance = new this(notebookView, style);
    instance.render(style);
    return instance;
  }

  // Instance Methods

  public render(style: StyleObject): void {
    this.$prefix.innerHTML = style.subrole ? FORMULA_SUBROLE_PREFIX.get(style.subrole!)! : '';

    // Look for a LATEX REPRESENTATION.
    const repStyles = this.notebookView.openNotebook.findStyles({ role: 'REPRESENTATION', type: 'TEX-EXPRESSION' }, style.id);
    let repStyle: StyleObject|undefined;
    if (repStyles.length > 0) {
      if (repStyles.length > 1) { console.warn("More than one REPRESENTATION/TEX-EXPRESSION styles found."); }
      repStyle = repStyles[0];
    } else { repStyle = undefined; }

    let html: Html|undefined
    if (repStyle) {
      let errorHtml: Html|undefined;
      // Render the formula data.
      const renderer = getRenderer(repStyle.type);
      ({ html, errorHtml } = renderer(repStyle.data));
      if (errorHtml) {
        html = `<div class="error">${errorHtml}</div><tt>${escapeHtml(style.data.toString())}</tt>`;
      }
    } else {
      html = "<i>No TeX representations for formula</i>";
    }

    // Render Wolfram evaluation if it exists.
    // REVIEW: Rendering evaluation annotations should probably be
    //         done separately from rendering the formula,
    //         but for now, for lack of a better place to put them,
    //         we are just appending the evaluation
    //         to the end of the formula.
    {
      const findOptions: FindStyleOptions = { role: 'EVALUATION', recursive: true };
      const evaluationStyles = this.notebookView.openNotebook.findStyles(findOptions, style.id);
      for (const evaluationStyle of evaluationStyles) {
        // HACK ALERT: We only take evaluations that are numbers:
        const evalStr = evaluationStyle.data.toString();
        if (/^\d+$/.test(evalStr)) {
          html += ` [=${evalStr}]`;
        }
      }
    }

    // Render list of equivalent styles, if there are any.
    // REVIEW: Rendering equivalency annotations should probably be
    //         done separately from rendering the formula,
    //         but for now, for lack of a better place to put them,
    //         we are just appending the list of equivalent formulas
    //         to the end of the formula.
    {
      const findOptions: FindRelationshipOptions = { fromId: style.id, toId: style.id, role: 'EQUIVALENCE' };
      const relationships = this.notebookView.openNotebook.findRelationships(findOptions);
      const equivalentStyleIds = relationships.map(r=>(r.toId!=style.id ? r.toId : r.fromId)).sort();
      if (equivalentStyleIds.length>0) {
        html += ` {${equivalentStyleIds.join(', ')}}`;
      }
    }

    this.$formula.innerHTML = html!;
  }

  public renderTools($tools: HTMLDivElement): void {
    super.renderTools($tools);
    const style = this.notebookView.openNotebook.getStyle(this.styleId);
    // REVIEW: If we attached tool styles to the top-level style,
    //         then we would not need to do a recursive search.
    const findOptions2: FindStyleOptions = { type: 'TOOL-DATA', recursive: true };
    const toolStyles = this.notebookView.openNotebook.findStyles(findOptions2, style.id);
    for (const toolStyle of toolStyles) {
      const toolData: ToolData = toolStyle.data;
      let html: Html;
      if (toolData.tex) {
        const latexRenderer = getRenderer('TEX-EXPRESSION');
        const results = latexRenderer!(toolData.tex);
        if (results.html) { html = results.html; }
        else { html = results.errorHtml!; }
      } else {
        html = toolData.html!;
      }
      const $button = $new('button', {
        class: 'tool',
        html,
        listeners: { 'click': _e=>this.notebookView.useTool(toolStyle.id) }
      });
      $tools.appendChild($button);
    }
  }

  // -- PRIVATE --

  // Constructor

  private constructor(notebookView: NotebookView, style: StyleObject) {
    super(notebookView, style, 'formulaCell');

    // Create our child elements: handle, status, formula, tools, and delete button.
    // REVIEW: Use $new above to create children declaratively.
    this.$prefix = $new<HTMLDivElement>('div', { class: 'prefix', appendTo: this.$elt });
    this.$formula = $new<HTMLDivElement>('div', { class: 'formula', appendTo: this.$elt });
    $new<HTMLDivElement>('div', { class: 'handle', html: `(${style.id})`, appendTo: this.$elt });
    $new<HTMLDivElement>('div', { class: 'status', html: "&nbsp;", appendTo: this.$elt });
  }

  // Private Instance Properties

  private $formula: HTMLDivElement;
  private $prefix: HTMLDivElement;

  // Private Instance Methods

}
