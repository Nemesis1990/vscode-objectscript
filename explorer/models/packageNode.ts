import * as vscode from 'vscode';
import { NodeBase } from './nodeBase';
import { ClassNode } from './classesNode';

export class PackageNode extends NodeBase {
  public static readonly contextValue: string = 'packageNode';
  constructor(
    public readonly label: string,
    private readonly _items,
    private readonly _workspaceFolder: string,
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
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: 'packageNode'
      // iconPath: {
      //     light: path.join(__filename, '..', '..', '..', '..', 'images', 'light', 'package.svg'),
      //     dark: path.join(__filename, '..', '..', '..', '..', 'images', 'dark', 'package.svg')
      // }
    };
  }

  async getChildren(element): Promise<NodeBase[]> {
    return this._items.map(({ name, fullName, nodes }) =>
      nodes.length
        ? new PackageNode(name, nodes, this._workspaceFolder, this._namespace)
        : new ClassNode(name, fullName, this._workspaceFolder, this._namespace)
    );
  }

  getClasses(): string[] {
    const getNodes = (list, el) => list.concat(el.nodes.length ? el.nodes.reduce(getNodes, []) : el);
    const nodes = this._items.reduce(getNodes, []);
    return nodes.map(el => el.fullName);
  }
}
