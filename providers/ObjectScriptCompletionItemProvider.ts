import * as vscode from 'vscode';

import commands = require('./completion/commands.json');
import systemFunctions = require('./completion/systemFunctions.json');
import systemVariables = require('./completion/systemVariables.json');
import structuredSystemVariables = require('./completion/structuredSystemVariables.json');
import { ClassDefinition } from '../utils/classDefinition.js';
import { currentFile, CurrentFile, outputChannel } from '../utils/index.js';
import { AtelierAPI } from '../api/index.js';
import { ObjectScriptParser, COSClassDefinition, COSClassMethodDefinition, COSMethodDefinition } from './parser/cosParser.js';

export class ObjectScriptCompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    let ob = new ObjectScriptParser(document);
    outputChannel.appendLine("Trigger: " + context.triggerCharacter);
    outputChannel.show(true);
    if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter) {
      if (context.triggerCharacter === '#')
        return this.macro(document, position, token, context) || this.entities(document, position, token, context, ob.ClassDefinition);
      if (context.triggerCharacter === '.') return this.entities(document, position, token, context, ob.ClassDefinition);
    }
    return (
      this.locals(document, position, ob.ClassDefinition) ||
      this.dollarsComplete(document, position) ||
      this.commands(document, position) ||
      this.entities(document, position, token, context) ||
      this.macro(document, position, token, context) ||
      this.constants(document, position, token, context)
    );
  }

  macro(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter !== '#') {
      return null;
    }
    let range = document.getWordRangeAtPosition(position, /#+\b\w+[\w\d]*\b/);
    let line = range ? document.getText(range) : '';
    const api = new AtelierAPI();
    let curFile: CurrentFile = currentFile();
    if (range && line && line !== '') {
      api.getMacroList(curFile.name, line).then(data => {
        let arr = data.result.content.macros.map(el => {
          return {
            label: el,
            insertText: el,
            range
          }
        });
        arr.push({
          label: '##class()',
          insertText: new vscode.SnippetString('##class($0)'),
          range
        });
        arr.push({
          label: '##super()',
          insertText: new vscode.SnippetString('##super($0)'),
          range
        });
        arr.push({
          label: '#dim',
          insertText: new vscode.SnippetString('#dim $0 As $1 = $3'),
          range
        });
      });
    }
    return null;
  }

  commands(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    let word = document.getWordRangeAtPosition(position, /\s+\b\w+[\w\d]*\b/);
    let line = word ? document.getText(word) : '';

    if (line.match(/^\s+\b[a-z]+\b$/i)) {
      let search = line.trim().toUpperCase();
      let items = commands
        .filter(el => el.label.startsWith(search) || el.alias.findIndex(el2 => el2.startsWith(search)) >= 0)
        .map(el => ({
          ...el,
          kind: vscode.CompletionItemKind.Keyword,
          preselect: el.alias.includes(search),
          documentation: new vscode.MarkdownString(el.documentation.join('')),
          insertText: new vscode.SnippetString(el.insertText || `${el.label} $0`)
        }));
      if (!items.length) {
        return null;
      }
      return {
        // isIncomplete: items.length > 0,
        items
      };
    }
    return null;
  }

  dollarsComplete(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    let range = document.getWordRangeAtPosition(position, /\^?\$*\b\w+[\w\d]*\b/);
    let text = range ? document.getText(range) : '';
    let textAfter = '';

    let dollarsMatch = text.match(/(\^?\$+)(\b\w+\b)?$/);
    if (dollarsMatch) {
      let [search, dollars] = dollarsMatch;
      search = (search || '').toUpperCase();
      if (dollars === '$') {
        let items = [...this.listSystemFunctions(search, textAfter.length > 0), ...this.listSystemVariables(search)];
        return {
          isIncomplete: items.length > 1,
          items: items.map(el => {
            return {
              ...el,
              range
            };
          })
        };
      } else if (dollars === '^$') {
        return this.listStructuredSystemVariables(search, textAfter.length > 0).map(el => {
          return {
            ...el,
            range
          };
        });
      }
    }
    return null;
  }

  listSystemFunctions(search: string, open = false): vscode.CompletionItem[] {
    return systemFunctions
      .filter(el => el.label.startsWith(search) || el.alias.findIndex(el2 => el2.startsWith(search)) >= 0)
      .map(el => {
        return {
          ...el,
          kind: vscode.CompletionItemKind.Function,
          insertText: new vscode.SnippetString(el.label.replace('$', '\\$') + '($0' + (open ? '' : ')')),
          preselect: el.alias.includes(search),
          documentation: new vscode.MarkdownString(el.documentation.join(''))
        };
      });
  }

  listSystemVariables(search: string) {
    return systemVariables
      .filter(el => el.label.startsWith(search) || el.alias.findIndex(el2 => el2.startsWith(search)) >= 0)
      .map(el => {
        return {
          ...el,
          kind: vscode.CompletionItemKind.Variable,
          preselect: el.alias.includes(search),
          documentation: new vscode.MarkdownString(el.documentation.join('\n'))
        };
      });
  }

  listStructuredSystemVariables(search: string, open = false) {
    return structuredSystemVariables.map(el => {
      return {
        ...el,
        kind: vscode.CompletionItemKind.Variable,
        insertText: new vscode.SnippetString(el.label.replace('$', '\\$') + '($0' + (open ? '' : ')')),
        documentation: new vscode.MarkdownString(el.documentation.join('\n'))
      };
    });
  }

  constants(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    let range = document.getWordRangeAtPosition(position, /%?\b\w+[\w\d]*\b/);
    let kind = vscode.CompletionItemKind.Variable;
    if (context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
      return [
        {
          label: '%session'
        },
        {
          label: '%request'
        },
        {
          label: '%response'
        },
        {
          label: 'SQLCODE'
        },
        {
          label: '%ROWCOUNT'
        }
      ].map(el => ({ ...el, kind, range }));
    }
    return null;
  }

  locals(document: vscode.TextDocument, position: vscode.Position, classDef: COSClassDefinition
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    let context: COSClassMethodDefinition | COSMethodDefinition;
    let list: vscode.CompletionItem[] = [];
    if (!classDef) {
      return null;
    }
    context = classDef.getContext(document, position);
    if (context) {
      context.parameter.forEach((ele) => {
        list.push({
          label: ele.name,
          detail: ele.type,
          kind: vscode.CompletionItemKind.TypeParameter
        });
      })
      context.locals.forEach((ele) => {
        let kind = null;
        if (ele.type.indexOf(".")>=0) {
          kind = vscode.CompletionItemKind.Reference
        } else {
          kind = vscode.CompletionItemKind.Variable;
        }
        list.push({
          label: ele.name,
          detail: ele.type,
          kind: kind
        });
      });
    }
    return list;
  }

  entities(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
    cosClass?: COSClassDefinition
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    let range = document.getWordRangeAtPosition(position, /%?\b\w+[\w\d]*\b/) || new vscode.Range(position, position);
    let textBefore = document.getText(new vscode.Range(new vscode.Position(position.line, 0), range.start));
    let curFile = currentFile();
    let searchText = document.getText(range);
    let originalSearchText = searchText;
    const method = el => ({
      label: el.name,
      documentation: el.desc.length ? new vscode.MarkdownString(el.desc.join('')) : null,
      kind: vscode.CompletionItemKind.Method,
      insertText: new vscode.SnippetString(`${el.name}($0)`)
    });

    const parameter = el => ({
      label: `${el.name}`,
      documentation: el.desc.length ? new vscode.MarkdownString(el.desc.join('')) : null,
      kind: vscode.CompletionItemKind.Constant,
      range,
      insertText: new vscode.SnippetString(`${el.name}`)
    });

    const property = el => ({
      label: el.name,
      documentation: el.desc.length ? new vscode.MarkdownString(el.desc.join('')) : null,
      kind: vscode.CompletionItemKind.Property,
      insertText: new vscode.SnippetString(`${el.name}`)
    });

    const search = el => el.name.startsWith(originalSearchText);

    let classRef = textBefore.match(/##class\(([^)]+)\)\.#?$/i);
    if (classRef) {
      let [, className] = classRef;
      let classDef = new ClassDefinition(className);
      if (textBefore.endsWith('#')) {
        return classDef.parameters().then(data => data.filter(search).map(parameter));
      }
      return classDef.methods('class').then(data => data.filter(search).map(method));
    }
    if (curFile.fileName.endsWith('cls')) {
      let selfRef = textBefore.match(/(?<!\.)\.\.#?$/i);
      if (selfRef) {
        let classDef = new ClassDefinition(curFile.name);
        if (textBefore.endsWith('#')) {
          return classDef.parameters().then(data => data.filter(search).map(parameter));
        }
        return Promise.all([classDef.methods(), classDef.properties()]).then(data => {
          let [methods, properties] = data;
          return [...methods.filter(search).map(method), ...properties.filter(search).map(property)];
        });
      } else {
        let context: COSClassMethodDefinition | COSMethodDefinition
        let struct: string[] = [searchText];
        context = cosClass.getContext(document, position);
        if (!searchText) {
          searchText = textBefore.split(' ')[1].split('.')[0];
          struct = textBefore.split(' ')[1].split('.');
          struct.pop();
        }
        let classDef = null;
        context.locals.forEach((el) => {
          if (el.name === searchText) {
            classDef = new ClassDefinition(el.type);
          }
        });
        if (classDef) {
          if (struct.length>1) {
            struct.shift();
            return Promise.all([classDef.methods(), classDef.properties()]).then(data => {
              let [methods, properties] = data;
              outputChannel.appendLine(JSON.stringify(methods));
              let type = properties.filter(el => el.name === struct[0])[0].type;
              let tempClass: ClassDefinition = new ClassDefinition(type);
              struct.forEach((el, ind, arr) => {
                if (ind+1 === arr.length) {
                  return tempClass.properties();
                } else {
                  type = properties.filter(ele => ele.name == el)[0].type;
                }
              });
            }).then((data: any) => {
              return data.map(property);
            });
          } else {
            return Promise.all([classDef.methods(), classDef.properties()]).then(data => {
              let [methods, properties] = data;
              return [...methods.filter(search).map(method), ...properties.filter(search).map(property)];
            });
          }
        }
      }
    }

    return null;
  }
}

