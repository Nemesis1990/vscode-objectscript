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
    try {
      let ob = new ObjectScriptParser(document);
      if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter) {
        if (context.triggerCharacter === '#')
          return this.entities(document, position, token, context, ob.ClassDefinition) || this.macro(document, position, token, context);
        if (context.triggerCharacter === '.') return this.entities(document, position, token, context, ob.ClassDefinition);
      }
      let list = [];
      let dollars: any = this.dollarsComplete(document, position);
      let commands: any = this.commands(document, position);
      let entities = this.entities(document, position, token, context, ob.ClassDefinition);
      let macro = this.macro(document, position, token, context);
      let constants = this.constants(document, position, token, context);
      let locals = this.locals(document, position, ob.ClassDefinition);
      list = commands ? list.concat(commands.items || commands) : list;
      list = dollars ? list.concat(dollars.items || dollars) : list;
      list = entities ? list.concat(entities) : list;
      list = macro ? list.concat(macro) : list;
      list = constants ? list.concat(constants) : list;
      list = locals ? list.concat(locals) : list;
      return list;
    } catch (err) {
      outputChannel.appendLine(err.message || err);
    }
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
      return api.getMacroList(curFile.name, line).then(data => {
        let arr = data.result.content.macros.map(el => ({
            label: el,
            insertText: el,
            range
        }));
        arr.push({
          label: '##class()',
          insertText: new vscode.SnippetString('##class($1).$0'),
          range
        });
        arr.push({
          label: '##super()',
          insertText: new vscode.SnippetString('##super($0)'),
          range
        });
        arr.push({
          label: '#dim',
          insertText: new vscode.SnippetString('#dim $0 As $1 = $0'),
          range
        });
        return arr;
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
    let parseArgs = el => {
      let markdown: string = el.name+"(";
      el.args.forEach((arg, ind, arr) => {
        markdown += '${'+(ind+1)+':'+arg.name+'}' + ((arr.length-1!==ind) ? ',' : '');
      });
      markdown += ')$0';
      return markdown;
    }
    const method = el => ({
      label: el.name,
      documentation: el.desc.length ? new vscode.MarkdownString(el.desc.join('')) : null,
      kind: vscode.CompletionItemKind.Method,
      //insertText: new vscode.SnippetString(`${el.name}($0)`)
      insertText: new vscode.SnippetString(parseArgs(el))
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
      insertText: new vscode.SnippetString(`${el.name}`),
    });

    const cls = el => {
      // @ts-ignore
      let searchText = line.replace('AS', '[AS]').split('[AS]')[1].trim();
      if (isClassContainer) {
        searchText = line.split('##class(').join('##CLASS(').split('##CLASS(')[1].replace(')','').trim();
      }
      let regex: RegExp = new RegExp('^('+searchText+')', 'i');
      let snippet = el.name.replace('.cls','').replace(regex, '');
      return {
        label: `${snippet}`,
        documentation: el.name,
        kind: vscode.CompletionItemKind.Class,
        insertText: new vscode.SnippetString(`${snippet}$0`)
      }
    }

    const search = el => el.name.startsWith(originalSearchText);

    // are we trying to dim something?
    let isDim = false;
    let isClassContainer = false;
    let line = document.lineAt(position.line).text.toUpperCase();
    let packname = line.replace('AS', '[AS]').split('[AS]')[1] || '';
    packname = packname.trim();
    if ((line.indexOf('#DIM')>=0) && (line.indexOf('=')===-1)) {
      isDim = true;
    }
    if (/(##class)/i.test(line) && textBefore.endsWith('.') && !textBefore.endsWith(').')) {
      isClassContainer = true;
      packname = line.split('##class(').join('##CLASS(').split('##CLASS(')[1].replace(')','').trim();
    }
    if (isDim || isClassContainer) {
      const api = new AtelierAPI();
      return api.getDocNames({category: 'cls', generated: false, filter: packname})
        .then(data => data.result.content.map(cls))
        .catch(ex => outputChannel.appendLine(ex.error || ex));
    }

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
        if (!searchText) {
          searchText = textBefore.replace('(', '').split(' ')[1].split('.')[0];
          struct = textBefore.replace('(', '').split(' ')[1].split('.');
          struct.pop();
        }
        context = cosClass.getContext(document, position);
        let classDef = null;
        context.locals.forEach((el) => {
          if (el.name === searchText) {
            classDef = new ClassDefinition(el.type);
          }
        });
        if (classDef) {
          if (struct.length>1) {
            let getInfo = (classDef, struct) => {
              struct.shift();
              return Promise.all([classDef.methods(), classDef.properties()]).then(data => {
                data[0] = data[0].filter(el => el.name === struct[0]);
                data[1] = data[1].filter(el => el.name === struct[0]);
                let type = data[1][0].type;
                let cls: ClassDefinition = new ClassDefinition(type);
                if (struct.length>1) {
                  return getInfo(cls, struct);
                } else {
                  return Promise.all([cls.methods(), cls.properties()]).then(data => {
                    let [methods, properties] = data;
                    return [  ...methods.filter(search).map(method),
                              ...properties.filter(search).map(property)]
                  });
                }
              });
            }
            return getInfo(classDef, struct);
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

