import * as vscode from 'vscode';
import { NodeBase } from './nodeBase';
import { DocumentContentProvider } from '../../providers/DocumentContentProvider';

export class ClassNode extends NodeBase {
  public static readonly contextValue: string = 'classNode';
  constructor(
    public readonly label: string,
    public readonly fullName: string,
    private _workspaceFolder: string,
    private _namespace: string
  ) {
    super(label);
  }

<<<<<<< HEAD
  getWorkspacefolder(): string {
=======
  get workspaceFolder(): string {
>>>>>>> d77e7428a0a674e6f4191696875070e7e86f997f
    return this._workspaceFolder;
  }

  getTreeItem(): vscode.TreeItem {
    let displayName: string = this.label;

    return {
      label: `${displayName}`,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: 'classNode',
      command: {
        command: 'vscode-objectscript.explorer.openClass',
        arguments: [DocumentContentProvider.getUri(this.fullName, this._workspaceFolder, this._namespace)],
        title: 'Open class'
      }
      // iconPath: {
      //     light: path.join(__filename, '..', '..', '..', '..', 'images', 'light', 'class.svg'),
      //     dark: path.join(__filename, '..', '..', '..', '..', 'images', 'dark', 'class.svg')
      // }
    };
  }
}
