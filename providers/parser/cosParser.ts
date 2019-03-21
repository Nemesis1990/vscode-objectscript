import * as vscode from "vscode";

export class ObjectScriptParser {

    public ClassDefinition: COSClassDefinition;

    constructor(textDocument: vscode.TextDocument) {
        this.ClassDefinition = this._parse(textDocument);
    }
    private _parse(textDocument: vscode.TextDocument): COSClassDefinition {
        return COSClassDefinition.parse(textDocument);
    }
}


export class COSClassDefinition {
    // Name of Class
    name: string = '';
    // Containing Methods
    methods: COSMethodDefinition[] = [];
    // Containing ClassMethods
    classmethods: COSClassMethodDefinition[] = [];
    // Containing indizies
    indizes: COSIndexDefinition[] = [];
    // Containing Properties
    properties: COSPropertyDefinition[] = [];
    // Containing Parameters
    parameters: COSParameterDefinition[] = [];

    static parse(textDocument: vscode.TextDocument): COSClassDefinition {
        try {
            let classDef: COSClassDefinition = new COSClassDefinition();
            let maxLines = textDocument.lineCount;
            for (let i = 0; i<maxLines; i++) {
                let line: vscode.TextLine = textDocument.lineAt(i);
                let lineSplit = line.text.split('=').join(' = ').split(' ');
                if (!line.isEmptyOrWhitespace) {
                    if ((lineSplit[0] || '').toUpperCase()==="CLASS") {
                        classDef.name = lineSplit[1];
                    }
                    if ((lineSplit[0] || '').toUpperCase()=== "PROPERTY") {
                        classDef.properties.push(COSPropertyDefinition.parse(line.text))
                    }
                    if ((lineSplit[0] || '').toUpperCase() === 'CLASSMETHOD') {
                        classDef.classmethods.push(COSClassMethodDefinition.parse(line.text, i, textDocument));
                    }
                    if ((lineSplit[0] || '').toUpperCase() === 'METHOD') {
                        classDef.methods.push(COSMethodDefinition.parse(line.text, i, textDocument));
                    }
                }
            }
            return classDef;
        } catch (ex) {
            throw ex
        }
    }

    getContext(textDocument: vscode.TextDocument, position: vscode.Position) {
        let startFound = false;
        let currPosition: number = position.line;
        let context: COSClassMethodDefinition | COSMethodDefinition
        while ((!startFound) && (currPosition>=0)) {
            currPosition--;
            let line = (textDocument.lineAt(currPosition).text || '').toUpperCase();
            let name: string = (textDocument.lineAt(currPosition).text || '').replace('(',' ').split(' ')[1];
            if (line.startsWith('CLASSMETHOD')) {
                context = this.classmethods[this.classmethods.findIndex((val, ind, arr) => {
                    return (val.name===name);
                })];
                startFound = true;
            }
            if (line.startsWith('METHOD')) {
                context = this.methods[this.methods.findIndex((val, ind, arr) => {
                    return (val.name===name);
                })];
                startFound = true;
            }
        }
        return context;
    }

}

export class COSClassMethodDefinition {
    // Locals
    locals: COSLocalVariableDefinition[] = [];
    // Parameters
    parameter: COSMethodParameterDefinition[] = [];
    // Name of ClassMethod
    name: string;
    // Returns
    returns: string;

    static parse(line: string, lineNumber: number, textDocument: vscode.TextDocument): COSClassMethodDefinition {
        let metDef: COSClassMethodDefinition = new COSClassMethodDefinition();
        let normalize = line => line.replace('(', ' (').split('(').join('').split(',').join('').split(')').join('').split("}").join("} ").split(' ');
        let linesplit = normalize(line);
        if ((linesplit[0] || '').toUpperCase().startsWith("CLASSMETHOD")) {
            metDef.name = linesplit[1];
        }
        linesplit.forEach((word, index, arr: string[]) => {
            word = word.toUpperCase();
            if (word.startsWith("CLASSMETHOD")) {
                metDef.name = arr[index+1];
                metDef.returns = arr[arr.length-1];
            } else {
                if ((!word.startsWith("=")) && (!word.startsWith("AS"))) {
                    //Keyword
                    if ((!(arr[index-1] || '').toUpperCase().startsWith("AS")) 
                    && (!word.startsWith("{"))
                    && (word !== '""')
                    && (word !== metDef.name.toUpperCase())) {
                        // parametername
                        let par = {
                            name: (arr[index] || ''),
                            type: (arr[index+1] === "AS" ? arr[index+2]: '%String'),
                            default: (arr[index+3] === "=" ? ((arr[index+4] || '').startsWith("{") ? '[COMPUTED]' : arr[index+4]) : '""')
                        }
                        metDef.parameter.push(par);
                    }
                }
            }
        });
        // Line at end. Time to find the body of the method to parse the locals
        let startOfMethod: vscode.Position = new vscode.Position(lineNumber+1, 0);
        let endOfMethod: vscode.Position;
        let endFound = false;
        let offset = 1;
        let textline: vscode.TextLine;
        let countOpen: number = 0;
        let countClose: number = 0;

        while (!endFound) {
            textline = textDocument.lineAt(lineNumber+offset);
            if (textline.text.indexOf("{")>=0) {
                countOpen++;
            }
            if (textline.text.indexOf("}")>=0) {
                countClose++;
            }
            offset++;
            if (countOpen === countClose) {
                endOfMethod = new vscode.Position(textline.lineNumber, 0);
                endFound = true;
            }
        }
        let range: vscode.Range = new vscode.Range(startOfMethod, endOfMethod);
        let methodBody = textDocument.getText(range);
        let search = (prop, what): number => {
            let index = null;
            metDef.locals.forEach((val, ind) => {
                if (val[prop] === what) {
                    index = ind;
                }
            })
            return index;
        }
        linesplit = methodBody.split(/\n/);
        linesplit.forEach((line, index, arr) => {
            if (/^[a-z].*/i.test(line)) {
                return;
            }
            let lineUpper = line.toUpperCase().split(/\t/).join('').trim();
            let split = line.split(' ');
            if (lineUpper.startsWith("S") || lineUpper.startsWith("SET")) {
                let varname: string = (split[1] || '').split('=')[0];
                if (varname.indexOf("(")>=0 || varname.indexOf(".")>=0 || varname.startsWith('$')) {
                    return
                }
                if (!search("name", varname)) {
                    let varDef: COSLocalVariableDefinition = 
                        new COSLocalVariableDefinition();
                    varDef.name = varname;
                    varDef.type = 'UNDEFINED';
                    metDef.locals.push(varDef);
                }
            }
            if (lineUpper.startsWith("#DIM")) {
                let varname: string = (split[1] || '').split('=')[0];
                if (varname.startsWith('$')) {
                    return
                }
                let type: string = 'UNDEFINED';
                if ((split[2] || '').toUpperCase() === "AS") {
                    type = split[3];
                }
                if (!search("name", varname)) {
                    let varDef: COSLocalVariableDefinition =
                        new COSLocalVariableDefinition();
                    varDef.name = varname;
                    varDef.type = type;
                    metDef.locals.push(varDef);
                }
            }
        });
        return metDef;
    }
}

export class COSMethodDefinition {
    locals: COSLocalVariableDefinition[] = [];
    // Parameters
    parameter: COSMethodParameterDefinition[] = [];
    // Name of ClassMethod
    name: string;
    // Returns
    returns: string;

    static parse(line: string, lineNumber: number, textDocument: vscode.TextDocument): COSMethodDefinition {
        let metDef: COSMethodDefinition = new COSMethodDefinition();
        let normalize = line => line.replace('(', ' (').split('(').join('').split(',').join('').split(')').join('').split("}").join("} ").split(' ');
        let linesplit = normalize(line);

        if ((linesplit[0] || '').toUpperCase().startsWith("METHOD")) {
            metDef.name = linesplit[1];
        }
        linesplit.forEach((word, index, arr) => {
            word = word.toUpperCase();
            if (word.startsWith("CLASSMETHOD")) {
                metDef.name = arr[index+1];
                metDef.returns = arr[arr.length-1];
            } else {
                if ((!word.startsWith("=")) && (!word.startsWith("AS"))) {
                    //Keyword
                    if ((!arr[index-1].toUpperCase().startsWith("AS")) 
                    && (!word.startsWith("{"))
                    && (word !== '')
                    && (word !== metDef.name.toUpperCase())) {
                        // parametername
                        metDef.parameter.push({
                            name: arr[index],
                            type: (arr[index+1] === "AS" ? arr[index+2]: '%String'),
                            default: (arr[index+3] === "=" ? (arr[index+4].startsWith("{") ? '[COMPUTED]' : arr[index+4]) : '')
                        });
                    }
                }
            }
        });
        // Line at end. Time to find the body of the method to parse the locals
        let startOfMethod: vscode.Position = new vscode.Position(lineNumber+1, 0);
        let endOfMethod: vscode.Position;
        let endFound = false;
        let offset = 1;
        let textline: vscode.TextLine;
        let countOpen: number = 0;
        let countClose: number = 0;
        
        while (!endFound) {
            textline = textDocument.lineAt(lineNumber+offset);
            if (textline.text.indexOf("{")>=0) {
                countOpen++;
            }
            if (textline.text.indexOf("}")>=0) {
                countClose++;
            }
            offset++;
            if (countOpen === countClose) {
                endOfMethod = new vscode.Position(textline.lineNumber, 0);
                endFound = true;
            }
        }
        let range: vscode.Range = new vscode.Range(startOfMethod, endOfMethod);
        let methodBody = textDocument.getText(range);
        let search = (prop, what): number => {
            let index = null;
            metDef.locals.forEach((val, ind) => {
                if (val[prop] === what) {
                    index = ind;
                }
            })
            return index;
        }
        linesplit = methodBody.split(/\n/);
        linesplit.forEach((line, index, arr) => {
            if (/^[a-z].*/i.test(line)) {
                return;
            }
            let lineUpper = line.toUpperCase().split(/\t/).join('').trim();
            let split = line.split(' ');
            if (lineUpper.startsWith("S") || lineUpper.startsWith("SET")) {
                let varname: string = (split[1] || '').split('=')[0];
                if (varname.indexOf("(")>=0 || varname.indexOf(".")>=0 || varname.startsWith('$')) {
                    return
                }
                if (!search("name", varname)) {
                    let varDef: COSLocalVariableDefinition = 
                        new COSLocalVariableDefinition();
                    varDef.name = varname;
                    varDef.type = 'UNDEFINED';
                    metDef.locals.push(varDef);
                }
            }
            if (lineUpper.startsWith("#DIM")) {
                let varname: string = (split[1] || '').split('=')[0];
                if (varname.startsWith('$')) {
                    return
                }
                let type: string = 'UNDEFINED';
                if ((split[2] || '').toUpperCase() === "AS") {
                    type = split[3];
                }
                if (!search("name", varname)) {
                    let varDef: COSLocalVariableDefinition =
                        new COSLocalVariableDefinition();
                    varDef.name = varname;
                    varDef.type = type;
                    metDef.locals.push(varDef);
                }
            }
        });
        return metDef;
    }
}

export class COSIndexDefinition {
    // Name of Index
    name: string;
    // Property-Name of Index
    property: string;
    // type of index e.g. Bitmap
    type: string;
}

export class COSPropertyDefinition {
    // Name of Property
    name: string;
    // Type of Property e.g. %String or User.Person
    type: string;

    static parse(line: string): COSPropertyDefinition {
        let propDef: COSPropertyDefinition = new COSPropertyDefinition();
        let linesplit = line.split(' ');
        if ((linesplit[0] || '').toUpperCase()==='PROPERTY') {
            propDef.name = linesplit[1];
            propDef.type = linesplit[3];
        }
        return propDef;
    }
}

export class COSParameterDefinition {
    // Name of parameter
    name: string;
    // value of Parameter
    value: string;
}

export class COSLocalVariableDefinition {
    name: string;
    type: string;
}

export class COSMethodParameterDefinition {
    // Name of Parameter
    name: string;
    // type of parameter e.g. User.Person or %String
    type: string;
    // Default value of Parameter
    default: string;
}