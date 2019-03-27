
// Requirements

// import { apiGetRequest, apiPostRequest } from './api.js';
// import { deserializeNotebook, serializeNotebook } from './notebook.js';
// import { tdoc, numMathStyles, numTextStyles,
//          mathSimplifyRule, applyStyle} from './tdoc.js';

// Constants

const MYSCRIPT_RECO_PARAMS = {
  protocol: 'WEBSOCKET',
  apiVersion: 'V4',
  v4: {
    export: {
      jiix: { strokes: true }
    },
    math: {
      mimeTypes: ['application/x-latex',
                  'application/vnd.myscript.jiix',
                  'text/html']
    },
    text: {
      guides: { enable: false },
      smartGuide: false,
    },
  },
};

// Global Variables

var GLOBAL_TDOC;

// Event Handlers

async function onDomReady(_event){
  try {
    $('#bannerClose').addEventListener('click', hideBanner);

    $('#textButton').addEventListener('click', switchToTextInput);
    $('#mathButton').addEventListener('click', switchToMathInput);

    const editorElt = $('#inputText');
    const editorConfig = getMyScriptConfig('TEXT');
    MyScript.register(editorElt, editorConfig);
    editorElt.addEventListener('changed', event=>{
      $('#undoButton').disabled = !event.detail.canUndo;
      $('#redoButton').disabled = !event.detail.canRedo;
      $('#clearButton').disabled = !event.detail.canUndo;
      $('#convertButton').disabled = !event.detail.canUndo;
    });
    editorElt.addEventListener('exported', event=>{
      console.dir(event.detail);
      if (event.detail.exports) {
        $('#previewText').innerText = event.detail.exports['text/plain'];
        $('#insertButton').disabled = false;
      } else {
        $('#previewText').innerText = '';
        $('#insertButton').disabled = true;
      }
    });

    $('#undoButton').addEventListener('click', _event=>editorElt.editor.undo());
    $('#redoButton').addEventListener('click', _event=>editorElt.editor.redo());
    $('#clearButton').addEventListener('click', _event=>editorElt.editor.clear());
    $('#convertButton').addEventListener('click', _event=>editorElt.editor.convert());

    $('#insertButton').addEventListener('click', event=>{
      console.log("Insert clicked TODO");
    });

    // const mathEditorElt = $('#mathEditor');
    // const mathEditorConfig = getMyScriptConfig('MATH');
    // MyScript.register(mathEditorElt, mathEditorConfig);

    // // Open a notebook
    // const openResults = await apiGetRequest('open');
    // // TODO: check openResults.ok
    // const pagesElt = $('#pages');

    // // Rob proposes that a notebook have a reference to a backing TDoc
    // // At the moment this TDoc is volatile, it is not persistent
    // // and is created on the fly. It can only be viewed through a separate action.
    // //    deserializeNotebook(pagesElt, openResults.notebook);
    // //    deserializeNotebook(pagesElt, openResults.notebook, new tdoc());
    // GLOBAL_TDOC  = new tdoc();
    // deserializeNotebook(pagesElt, openResults.notebook, GLOBAL_TDOC);
    // showStatusMessage("Notebook opened successfully.");

    // const saveButtonElt = $('#saveButton');
    // saveButtonElt.addEventListener('click', onSaveButtonClicked);

    // const enhanceButtonElt = $('#enhanceButton');
    // enhanceButtonElt.addEventListener('click', onEnhanceButtonClicked);
  } catch (err) {
    showErrorHeader("Error initializing page", err);
  }
}

// async function onSaveButtonClicked(event) {
//   try {
//     const pagesElt = $('#pages');
//     const notebook = serializeNotebook(pagesElt);
//     await apiPostRequest('save', { notebook });
//     this.disabled = true;
//     showStatusMessage("Notebook saved successfully.");
//   } catch(err) {
//     showErrorHeader("Error saving notebook", err);
//   }
// }

// function onEnhanceButtonClicked(event) {
//   try {
//     let ms0 = numMathStyles(GLOBAL_TDOC);
//     let r = mathSimplifyRule;
//     GLOBAL_TDOC = applyStyle(GLOBAL_TDOC,[r]);
//     let ms1 = numMathStyles(GLOBAL_TDOC);
//     this.disabled = true;
//     let numEnhancements = ms1 - ms0;
//     showStatusMessage(numEnhancements > 0 ? `Found ${numEnhancements} simplifications`
//                       : 'No mathematical simplications found');
//     console.log(GLOBAL_TDOC);
//   } catch(err) {
//     console.log("Error",err);
//     showErrorHeader("Error enhanceing TDOC", err);
//   }
// }

// Helper Functions

function $(id) {
  return document.getElementById(id.substring(1));
}

function getMyScriptConfig(editorType) {
  return {
    recognitionParams: {
      ...MYSCRIPT_RECO_PARAMS,
      server: getMyScriptKeys(),
      type: editorType,
    },
  };
}

function getMyScriptKeys() {
  const htmlElement = document.documentElement;
  return {
    applicationKey: htmlElement.dataset.applicationkey,
    hmacKey: htmlElement.dataset.hmackey,
  }
}

function hideBanner(_event) {
  $('#banner').style.display = 'none';
}

function showErrorHeader(msg, err) {
  const errorHeader = $('#errorHeader');
  errorHeader.innerText = msg + (err ? ': ' + err.message : '');
  errorHeader.style.display = 'block';
}

function showStatusMessage(msg) {
  console.log(msg);
}

function switchToMathInput(_event) {
  $('#inputText').style.display = 'none';
  $('#textButton').disabled = false;
  $('#inputMath').style.display = 'flex';
  $('#mathButton').disabled = true;
}

function switchToTextInput(_event) {
  $('#inputMath').style.display = 'none';
  $('#mathButton').disabled = false;
  $('#inputText').style.display = 'flex';
  $('#textButton').disabled = true;
}

// Application Entry Point

function main(){
  window.addEventListener('DOMContentLoaded', onDomReady);
}

main();
