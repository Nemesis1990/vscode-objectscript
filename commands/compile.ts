import vscode = require('vscode');
import fs = require('fs');
import { AtelierAPI } from '../api';
import { currentFile, CurrentFile, outputChannel } from '../utils';
import { documentContentProvider, config } from '../extension';
import { DocumentContentProvider } from '../providers/DocumentContentProvider';
import cp = require('child_process');

async function compileFlags(): Promise<string> {
  const defaultFlags = config().compileFlags;
  return vscode.window.showInputBox({
    prompt: 'Compilation flags',
    value: defaultFlags
  });
}

async function importFile(file: CurrentFile, flags: string, ignoreConflicts: boolean): Promise<any> {
  const api = new AtelierAPI();
  const put = (file, flags) => {
    api.putDoc(
      file.name,
      {
        enc: false,
        content: file.content.split(/\r?\n/)
      },
      true
    )
    .then(data => compile(file, flags))
    .catch((error: Error) => {
      outputChannel.appendLine(error.message);
      outputChannel.show(true);
      vscode.window.showErrorMessage(error.message);
    });
  }

  return api.getDoc(file.name).then(data => {
    let hasConflict = false;
    let serverDate: Date = new Date(data.result.ts);
    
    if (serverDate>file.timestamp) {
      hasConflict = !ignoreConflicts;
    }
    if (!hasConflict) {
      put(file, flags);
    } else {
      vscode.window.showErrorMessage('Server has a newer version of this document.',
      ...['Save local copy', 'Save server copy','Merge Tool','cancel']).then(choice => {
        if (choice==='Save local copy') {
          importFile(file, flags, true);
        } else if (choice === 'Save server copy') {
          outputChannel.appendLine('Loading changes from server');
          outputChannel.show(true);
          loadChanges(file);
        } else if (choice === 'Merge Tool') {
          let incoming: string[] = data.result.content;
          fs.writeFileSync(file.uri.fsPath+'.inc', incoming.join('\n'));
          fs.writeFileSync(file.uri.fsPath+'.merge', '');
          let child: cp.ChildProcess = 
            cp.spawn(`git merge-file ${file.uri.fsPath} ${file.uri.fsPath+'.merge'} ${file.uri.fsPath+'.inc'} `,
              { shell: true });
          child.on('exit', (code, signal) => {
            let edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
            edit.deleteFile(vscode.Uri.file(file.uri.fsPath+'.inc'));
            edit.deleteFile(vscode.Uri.file(file.uri.fsPath+'.merge'));
            vscode.workspace.applyEdit(edit).then(() =>{}, (err) => outputChannel.appendLine(err.message || err));
            if (code===1) {
              vscode.workspace.openTextDocument(file.uri);
            } else {
              outputChannel.appendLine(`child process exited with code ${code} signal ${signal}`);
            }
          });
          child.on('error', (err: any) => {
            outputChannel.appendLine(`ERR: ${err.message}`);
            outputChannel.appendLine('Merging failed. Canceling');
          })
        } else {
          outputChannel.appendLine('Compile canceled by user');
          outputChannel.show(true);
          vscode.window.showErrorMessage('Compile canceled by user');
        }
      })
    }
  }).catch((error: Error) => {
    if (error.message.indexOf('404')>0) {
      // well...that's a new file...lets put it on the server
      put(file, flags)
    } else {
      outputChannel.appendLine(error.message);
      outputChannel.show(true)
      vscode.window.showErrorMessage(error.message);
    }
  })
}

function updateOthers(others: string[]) {
  others.forEach(item => {
    const uri = DocumentContentProvider.getUri(item);
    documentContentProvider.update(uri);
  });
}

async function loadChanges(file: CurrentFile): Promise<any> {
  const api = new AtelierAPI();
  return api.getDoc(file.name).then(data => {
    fs.writeFileSync(file.fileName, (data.result.content || []).join('\n'));
    api
      .actionIndex([file.name])
      .then(data => data.result.content[0].others)
      .then(updateOthers);
  });
}

async function compile(file: CurrentFile, flags: string): Promise<any> {
  const api = new AtelierAPI();
  return api
    .actionCompile([file.name], flags)
    .then(data => {
      if (data.status && data.status.errors && data.status.errors.length) {
        throw new Error(`${file.name}: Compile error`);
      } else {
        vscode.window.showInformationMessage(`${file.name}: Compile successed`);
      }
      return file;
    })
    .then(loadChanges);
}

export async function importAndCompile(askFLags = false): Promise<any> {
  const file = currentFile();
  if (!file) {
    return;
  }
  if (!config('conn').active) {
    return;
  }
  const defaultFlags = config().compileFlags;
  const ignoreConflicts = config('conn').ignoreConflicts;
  const flags = askFLags ? await compileFlags() : defaultFlags;
  return importFile(file, flags, ignoreConflicts).catch(error => {
    console.error(error);
  });
}
