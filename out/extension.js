// Copyright SECBIT Labs 2018.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const cp = require("child_process");
const soljson = require("../solc/soljson.js");
// Known issues enumeration.
const secbitKnownIssues = {
    'erc20-no-return': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'erc20-return-false': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'erc20-no-decimals': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'erc20-no-name': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'erc20-no-symbol': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'transfer-no-revert': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'transfer-no-event': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'approve-no-event': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20',
    },
    'hardcode-addr': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'code'
    },
    'byte-array': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'gas'
    },
    'constant-mutability': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'fix-version': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'int-div': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'vulnerability'
    },
    'private-modifier': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'vulnerability'
    },
    'view-immutable': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'bad-name': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'tx-origin': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'vulnerability'
    },
    'throw': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'suicide': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'unchecked-math': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'vulnerability'
    },
    'sha3': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'timstamp': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'vulnerability'
    },
    'implicit-visibility': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'redundant-fallback': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'vulnerability'
    },
    'type-inference': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'revert-vs-require': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'pure-function': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'reentrance': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'vulnerability'
    },
    'dirty-padding': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'vulnerability'
    },
    'no-return': {
        'severity': vscode.DiagnosticSeverity.Information,
        'type': 'code'
    },
    'delegatecall': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'code'
    },
    'send-vs-transfer': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'vulnerability'
    },
    'forced-ether': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'vulnerability'
    },
    'pull-vs-push': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'vulnerability'
    },
    'blockhash': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'vulnerability'
    },
    'short-addr': {
        'severity': vscode.DiagnosticSeverity.Error,
        'type': 'erc20'
    },
    'transferfrom-no-allowed-check': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'erc20'
    },
    'approve-with-balance-verify': {
        'severity': vscode.DiagnosticSeverity.Warning,
        'type': 'erc20'
    }
};
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    console.log('Started SECBIT Solidity Static Analysis Extension');
    var l = "";
    for (let issue in secbitKnownIssues) {
        var s = 'Information';
        if (secbitKnownIssues[issue].severity == vscode.DiagnosticSeverity.Warning) {
            s = 'Warning';
        }
        else if (secbitKnownIssues[issue].severity == vscode.DiagnosticSeverity.Error) {
            s = 'Error';
        }
        l = l + '* ' + issue + '\n**' + secbitKnownIssues[issue].type + '**\n**' + s + '**\n\n';
    }
    let dc = vscode.languages.createDiagnosticCollection('solidity');
    function processErrors(doc, errs) {
        dc.clear();
        // Collect diagnostics.
        var diags = [];
        for (let err of errs) {
            console.log('Processing [' + err.tag + ']');
            var severity = vscode.DiagnosticSeverity.Information;
            if (!!secbitKnownIssues[err.tag]) {
                severity = secbitKnownIssues[err.tag].severity;
            }
            const diag = new vscode.Diagnostic(new vscode.Range(Number(err.startline) - 1, Number(err.startcolumn) - 1, Number(err.endline) - 1, Number(err.endcolumn) - 1), '[secbit:' + err.tag + '] ' + err.desc, severity);
            diags.push(diag);
        }
        dc.set(doc.uri, diags);
    }
    function updateDiags(doc) {
        if (doc.languageId != 'solidity') {
            return;
        }
        console.log('Started SECBIT analysis...');
        // Invoke solc with secbit args.
        let config = vscode.workspace.getConfiguration('secbit');
        var tags = [];
        if (!!config.enables) {
            for (let tag of config.enables) {
                if (!!secbitKnownIssues[tag]) {
                    tags.push(tag);
                }
                else {
                    vscode.window.showInformationMessage('Unknown check: ' + tag);
                }
            }
        }
        if (!!config.solc && config.solc != "") {
            // Use the given solc.
            var args = ['-o', '/', '--overwrite'];
            if (!!config.noSMT && config.noSMT == true) {
                args.push('--no-smt');
            }
            for (let tag of tags) {
                args.push('--secbit-tag');
                args.push(tag);
            }
            if (config.asERC20 === true) {
                args.push('--erc20');
            }
            // Use active editor as input file.
            let input = doc.uri.fsPath;
            // Error output.
            let output = input + ".err";
            args.push('--secbit-warnings');
            args.push(output);
            args.push(input);
            const solc = cp.spawn(config.solc, args);
            console.log("Running " + args.join(' '));
            // Show error info.
            solc.on('error', (err) => {
                vscode.window.showInformationMessage('Failed to start ' + config.solc);
            });
            solc.stderr.on('data', (data) => {
                vscode.window.showInformationMessage('Analysis failed:\n' + data);
            });
            // On finish, update diagnostics.
            solc.on('close', (code) => {
                console.log(`solc exited with code ${code}`);
                if (code != 0) {
                    if (fs.statSync(output)) {
                        fs.unlinkSync(output);
                    }
                    return;
                }
                // Read errors from output file.
                var errs = [];
                try {
                    var errFileContent = fs.readFileSync(output, 'utf8');
                    errs = JSON.parse(errFileContent)['secbit-warnings'];
                }
                catch (e) {
                    console.log(e);
                }
                if (fs.statSync(output)) {
                    fs.unlinkSync(output);
                }
                processErrors(doc, errs);
                console.log('Finished processing solc output.');
            });
        }
        else {
            // Use soljson.
            const compileJSON = soljson.cwrap('compileJSON', 'string', [
                'string',
                'number',
                'number',
                'number',
                'number',
                'string' //_tags
            ]);
            const result = compileJSON(
            /*_input*/ vscode.window.activeTextEditor.document.getText(), 
            /*_optimize*/ 1, 
            /*_isSECBIT*/ 1, 
            /*_noSMT*/ 1, 
            /*_asERC20*/ config.asERC20 === true ? 1 : 0, 
            /*_tags*/ tags.join(','));
            const output = JSON.parse(result);
            try {
                processErrors(doc, output['errors']);
            }
            catch (e) {
                console.log(e);
            }
        }
    }
    context.subscriptions.push(vscode.commands.registerCommand('secbit.analyze', () => {
        let ae = vscode.window.activeTextEditor;
        if (ae) {
            updateDiags(ae.document);
        }
    }));
    vscode.workspace.onDidSaveTextDocument(document => {
        let config = vscode.workspace.getConfiguration('secbit');
        if (!!config.onSave && config.onSave) {
            updateDiags(document);
        }
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    console.log('SECBIT Solidity Static Analysis Extension deactivated.');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map