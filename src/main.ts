import './style.css'
import { WebContainer } from '@webcontainer/api'
import { files } from '../file';
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'
import { FitAddon } from 'xterm-addon-fit'

import { basicSetup, EditorView } from 'codemirror'
import { javascript } from "@codemirror/lang-javascript"
import { ViewUpdate } from '@codemirror/view';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <div class="editor">

      <div id="textarea"></div>
    </div>
    <div class="preview">
      <iframe src="../loading.html"></iframe>
    </div>
    <div class="terminal"></div>
  </div>
`
const editor = new EditorView({
  extensions: [
    basicSetup, 
    javascript(),
    EditorView.updateListener.of((v: ViewUpdate) => {
      writeIndexJS( v.state.doc.toString())
    })
  ],

  parent: document.querySelector("#textarea") as HTMLTextAreaElement
})
const iframeEl: HTMLIFrameElement | null = document.querySelector("iframe")
const terminalEl: HTMLDivElement | null = document.querySelector('.terminal')

let webcontainerInstance: WebContainer
window.addEventListener('load', async ():Promise<void> => {
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert:  files['index.js'].file.contents },
  });
  const fitAddon = new FitAddon()

  const terminal = new Terminal({
    convertEol: true
  })
  terminal.loadAddon(fitAddon)
  terminal.open(terminalEl as HTMLDivElement)
  
  fitAddon.fit()

  webcontainerInstance = await WebContainer.boot()
  await webcontainerInstance.mount(files)

  webcontainerInstance.on('server-ready', (_port, url) => {
    iframeEl!.src = url
  })

  const shellProecss = await startShell(terminal)
  window.addEventListener('resize', () => {
    fitAddon.fit()
    shellProecss.resize({
      cols: terminal.cols,
      rows: terminal.rows
    })
  })
})

async function writeIndexJS(content: string) {
  await webcontainerInstance?.fs.writeFile('/index.js', content);
};

async function startShell(terminal: Terminal){
  const shellProecss = await webcontainerInstance.spawn('jsh',{
    terminal: {
      cols: terminal.cols,
      rows: terminal.rows,
    },
  })
  shellProecss.output.pipeTo(new WritableStream({
    write(data){
      terminal.write(data)
    }
  }))

  const input = shellProecss.input.getWriter()
  terminal.onData(data => {
    input.write(data)
  })
   
  return shellProecss
}