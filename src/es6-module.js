"use strict";

((window) => {
    let __es6module__ = [];
    let debug = false;
    
    function __compileEntries(entryStr) {
        let entriesTokens = [];
        let flag = false;
        let lastIndex = 0;
        let index = 0;
        for (; index < entryStr.length; index++) {
            let c = entryStr.charAt(index);
            if (c == "{") flag = true;
            if (c == "}") flag = false;
            if (c == "," && !flag) {
                entriesTokens.push(entryStr.substring(lastIndex, index).trim());
                lastIndex = index + 1;
            }
        }
        entriesTokens.push(entryStr.substring(lastIndex, index).trim());
        
        let entries = [];
        for (let etk of entriesTokens) {
            if (etk.indexOf("{") === 0) {
                etk = etk.replace(/(^\{|\}$)/g, "");
                
                let classEntry = [];
                let classEntryTokens = etk.split(/\s*,\s*/);
                for (let cetk of classEntryTokens) {
                    cetk = cetk.trim();
                    if (cetk != "") {
                        if (/^[^\s]+\s+as\s+[^\s]+$/.test(cetk)) {
                            let classEntryAsTokens = cetk.split(/\s+as\s+/);
                            classEntry.push([classEntryAsTokens[0].trim(), classEntryAsTokens[1].trim()]);
                        } else {
                            classEntry.push(cetk);
                        }
                    }
                }
                
                entries.push(classEntry);
            } else {
                entries.push(etk);
            }
        }
        return entries;
    }

    function __compileImport(s) {
        s = s.replace(/;$/, "").trim();
        let tokens = s.trim().split(/\s/);
        let entryStr = "";
        let url = "";
        
        if (tokens.indexOf("from") != -1) {
            let index = 0;
            for (; index < tokens.length; index++) {
                let tk = tokens[index];
                if (tk == "import") continue;
                if (tk == "from") break;
                entryStr += tk + " ";
            }
            url = tokens[index + 1];
        } else {
            url = tokens[1];
        }
        
        let globalEntries = [];
        let entries = [];
        if (entryStr != "") {
            entries = __compileEntries(entryStr);
            for (let i = 0; i < entries.length; i++) {
                if (/^\*\s+as\s+(.*)$/.test(entries[i])) {
                    globalEntries.push(entries[i].replace(/^\*\s+as\s+/, ""));
                    entries.splice(i, 1);
                    i--;
                }
            }
        }
        
        let compiledStatement = `await $import(JSON.parse('${JSON.stringify(entries)}'), ${url}, __es6module__);\n`;
        for (let v of entries) {
            if (typeof v == "string") {
                compiledStatement += `let ${v} = __es6module__['${v}'];\n`;
            } else {
                for (let vv of v) {
                    if (typeof vv == "string") {
                        compiledStatement += `let ${vv} = __es6module__["${vv}"];\n`;
                    } else {
                        compiledStatement += `let ${vv[1]} = __es6module__["${vv[1]}"];\n`;
                    }
                }
            }
        }
        for (let v of globalEntries) {
            compiledStatement += `let ${v} = __es6module__["*"];\n`; 
        }
        return compiledStatement;
    }

    function __compileExport(s) {
        s = s.trim().replace(/;$/, "").trim();
        let tokens = s.trim().split(/\s/);
        let entryStr = "";
        let defaultFlag = false;
        let url = "''";
        
        if (tokens.indexOf("default") != -1) {
            entryStr = tokens[2];
        } else {
            let index = 0;
            for (; index < tokens.length; index++) {
                let tk = tokens[index];
                if (tk == "export") continue;
                if (tk == "from") break;
                entryStr += tk + " ";
            }
            if (tokens.indexOf("from") != -1) {
                url = tokens[index + 1];
            }
        }
        
        let entries = __compileEntries(entryStr);
        
        let compiledStatement = "";
        
        let globalEntries = [];
        if (url != "''") {
            compiledStatement += __compileImport(s.replace("export", "import"));
            for (let i = 0; i < entries.length; i++) {
                if (entries[i] instanceof Array) {
                    for (let j = 0; j < entries[i].length; j++) {
                        if (entries[i][j] instanceof Array) {
                            entries[i][j] = entries[i][j][1];
                        }
                    }
                } else {
                    if (/^\*\s+as\s+(.*)$/.test(entries[i])) {
                        globalEntries.push(entries[i].replace(/^\*\s+as\s+/, ""));
                        entries.splice(i, 1);
                        i--;
                    }
                }
            }
        }
        
        if (globalEntries.length > 0)
            entries.push(globalEntries);
        compiledStatement += `$export(JSON.parse('${JSON.stringify(entries)}'));\n`;
        
        return compiledStatement;
    }
    
    function __compile(code) {
        let importRegExp = /import(\s+(.*)\s+from)?\s+["']{1}(.*)["']{1}\s*(?=;|\n|\r\n|$)/g;
        let exportRegExp = /export\s+(.*)(\s+from\s+["']{1}(.*)["']{1})?\s*(?=;|\n|\r\n|$)/g;
        
        let fun = `
            function $export (entries) {
                for (let e of entries) {
                    if (e instanceof Array) {
                        for (let ee of e) {
                            if (ee instanceof Array) {
                                eval('__es6module__["' + ee[1] + '"] = ' + ee[0]);
                            } else {
                                eval('__es6module__["' + ee + '"] = ' + ee);
                            }
                        }
                    } else {
                        eval('__es6module__["default"] = ' + e);
                    }
                }
            }
        `;
        let statements = code.match(importRegExp);
        statements = statements == null ? [] : statements;
        for (let s of statements) {
            code = code.replace(s, __compileImport(s));
        }
        statements = code.match(exportRegExp);
        statements = statements == null ? [] : statements;
        for (let s of statements) {
            code = code.replace(s, __compileExport(s));
        }
        return '"use strict";\n' + fun + code;
    }
    
    async function __runCode(__es6modulecode__) {
        let __es6module__ = {};
        let __es6modulefun__;
        eval(`
            __es6modulefun__ = async function () {
                ${__es6modulecode__}
                return __es6module__;
            };
        `);
        // console.log(__es6modulefun__)
        __es6module__ = await __es6modulefun__();
        // console.log(__es6module__)
        return __es6module__;
    }
    
    function __get(url) {        
        return new Promise(function (resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        resolve(xhr.response);
                    } else {
                        reject();
                    }
                }
            };
            xhr.open("get", url);
            xhr.send();
        });
    }
    
    function __importLazy(entries, url, that) {
        entries.forEach((v) => {
            if (v instanceof Array) {
                v.forEach((vv) => {
                    if (vv instanceof Array) {
                        that[vv[1]] = __es6module__[url][vv[0]];
                    } else {
                        that[vv] = __es6module__[url][vv];
                    }
                });
            } else {
                that[v] = __es6module__[url]["default"];
            }
            that["*"] = Object.assign({}, __es6module__[url]);
        });
    }
    
    function __removeJsComments(code) {    
        return code.replace(/(?:^|\n|\r)\s*\/\*[\s\S]*?\*\/\s*(?=\r|\n|$)/g, '\n').replace(/(?:^|\n|\r)\s*\/\/.*(?=\r|\n|$)/g, '\n');
    }
    
    async function $import(entries, url, that) {
        debug && console.log("Load js " + url)
        if (typeof that == "undefined") that = window;
        if (typeof __es6module__[url] == "undefined") {
            let code = await __get(url);
            code = __removeJsComments(code);
            code = __compile(code);
            debug && console.log(code);
            // debugger
            __es6module__[url] = await __runCode(code);
            debug && console.log(__es6module__[url]);
        }
        __importLazy(entries, url, that);
    }
    
    function $importScript(url, asyn) {
        let script = document.createElement("script");
        script.src = url;
        document.querySelector("head").appendChild(script);
        __get(url).then((code) => {
            eval.bind(window)(code);
        }).catch((e) => {
            console.error(e);
        });
    }

    window.addEventListener("load", function () {
        let script = document.querySelectorAll("script[type=module\\/main]");
        if (script.length != 0) {
            if (script.length > 1)
                console.warn("Please specific only one main entry of script, the first is used now");
            $import([], script[0].src, {});
        } else {
            console.warn("Please specific a main entry of script");
        }
    });
    
    window.$importScript = $importScript;
    window.$import = $import;
})(window);